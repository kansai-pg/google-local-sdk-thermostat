/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
const axios = require("axios").default;
const functions = require('firebase-functions');
const {smarthome} = require('actions-on-google');
const {google} = require('googleapis');
const admin = require('firebase-admin');
// Initialize Firebase
admin.initializeApp();
const firebaseRef = admin.database().ref('/');
// Initialize Homegraph
const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/homegraph'],
});
const homegraph = google.homegraph({
  version: 'v1',
  auth: auth,
});
// Hardcoded user ID
const USER_ID = '123';

const getauth0_userinfo = async (headers) => {
  const options = {
    method: 'GET',
    url: 'https://dev-8dv3lur6zl8osjo1.us.auth0.com/userinfo',
    headers: { authorization: headers.authorization },
  };

  try {
    const response = await axios.request(options);
    functions.logger.log("authorization", headers.authorization);
    return response.data;
  } catch (error) {
    functions.logger.error("auth0_error", error);
    throw error;
  }
};

const app = smarthome();

app.onSync(async (body, headers) => {
  const userinfo = await getauth0_userinfo(headers);
  // auth0から取得した認証情報
  functions.logger.log("auth0_req", userinfo);
  return {
    requestId: body.requestId,
    payload: {
      agentUserId: USER_ID,
      devices: [{
          // ここで指定したIDは device.id で後から取得できる
          // ほかのデバイスと重複しなければなんでも良い
          id: "thermostat",
          // デバイスに適したものを選ぶ
          type: 'action.devices.types.THERMOSTAT',
          traits: [
            // type によって対応しているトレイルは異なる
            'action.devices.traits.TemperatureSetting',
            'action.devices.traits.Modes'
          ],
          name: {
            // typeに関係なく、ここに記入した名前をアシスタントが読み上げる
            // アプリからの表示もここに記入した名前になる
            // 操作するときはここに記入した名前でアシスタントへ命令する
            name: 'エアコン',
          },
          willReportState: true,
          attributes: {
            // エアコン or スマートリモコンが対応している動作モードを書く
            "availableThermostatModes": [
              "fan-only",
              "heat",
              "cool",
              "dry",
              "on",
              "off"
            ],
            "thermostatTemperatureUnit": "C"
          },
          // アプリ上から表示される
          deviceInfo: {
            manufacturer: 'hate-ms-inc',
            model: 'esp32-dev-test',
            hwVersion: '1.9',
            swVersion: '1.9.1.9',
          },
          // マイコンに割り当てたIDを記入、もしくは自動取得する
          otherDeviceIds: [{
            deviceId: 'thermostat123',
          }],
          // その名の通りカスタムデータを定義出来る
          // ドキュメントを見ると複数データにも対応していそう
          // https://developers.home.google.com/cloud-to-cloud/intents/sync?hl=ja
          "customData": {
            // subはoauth認証時にユーザーを識別するためのID
            // ここに定義することによりauth0のAPIを初回時に1回叩くだけで良くなる
            "oauth_sub": userinfo.sub
          },
        },
        {
          id: "switch",
          type: 'action.devices.types.SWITCH',
          traits: [
            'action.devices.traits.OnOff'
          ],
          name: {
            name: '照明',
          },
          willReportState: false,
          deviceInfo: {
            manufacturer: 'hate-ms-inc',
            model: 'esp32-dev-test',
            hwVersion: '1.9',
            swVersion: '1.9.1.9',
          },
          otherDeviceIds: [{
            deviceId: 'switch123',
          }],
          "customData": {
            "oauth_sub": userinfo.sub
          },
        }
      ],
    },
  };
});

const queryFirebase = async (userinfo) => {
  // firebase realtime database のPATH
  const Ambient = await firebaseRef.child("Ambient").child(userinfo).once('value');
  const snapshot = await firebaseRef.child("users").child(userinfo).once('value');
  const snapshotVal = snapshot.val();
  const AmbientVal = Ambient.val();
  return {
    // type に応じた firebase realtime database のPATHを書く
    thermostatTemperatureSetpoint: snapshotVal.temperatureSetpoint,
    thermostatMode: snapshotVal.thermostatMode,
    thermostatTemperatureAmbient: AmbientVal.thermostatTemperatureAmbient,
    thermostatHumidityAmbient: AmbientVal.thermostatHumidityAmbient,
    on: snapshotVal.lightOnOff,
  };
};

app.onQuery(async (body) => {
  functions.logger.log('onQuery:',body);
  const {requestId} = body;
  const payload = {
    devices: {},
  };
  const queryPromises = [];
  const intent = body.inputs[0];
  for (const device of intent.payload.devices) {
    // onSyncで定義したsubをここで取得する
    queryPromises.push(queryFirebase(device.customData.oauth_sub)
        .then((data) => {
        // Add response to device payload
          payload.devices[device.id] = data;
        },
        ));
  }
  // Wait for all promises to resolve
  await Promise.all(queryPromises);
  return {
    requestId: requestId,
    payload: payload,
  };
});

const updateDevice = async (execution, userinfo) => {
  const {params, command} = execution;
  functions.logger.log('Request params:', params);
  let state; let ref;
  switch (command) {
    case 'action.devices.commands.ThermostatTemperatureSetpoint':
      const temperatureSetpoint = params.thermostatTemperatureSetpoint;
      if (temperatureSetpoint < 16 || temperatureSetpoint > 32) {
        throw new Error('valueOutOfRange');
      }
      state = { temperatureSetpoint: params.thermostatTemperatureSetpoint };
      break;
    case 'action.devices.commands.ThermostatSetMode':
      state = { thermostatMode: params.thermostatMode };
      break;
    case 'action.devices.commands.OnOff':
      state = { lightOnOff: params.on };
      break;
    default:
      // 未知のparamsが渡された場合の処理
      Object.keys(params).forEach(function (key) {
        throw new Error('Unknown params: ' + "Key: " + key + ", Value: " + params[key]);
      });
  }
  // ユーザーから取得したsubと紐付けてデータを保存する
  ref = firebaseRef.child("users").child(userinfo);
  return ref.update(state)
      .then(() => state);
};


app.onExecute(async (body) => {
  const {requestId} = body;
  // Execution results are grouped by status
  const result = {
    ids: [],
    status: 'SUCCESS',
    states: {
      online: true,
    },
  };

  const executePromises = [];
  functions.logger.log('onExecute:',body);
  const intent = body.inputs[0];
  for (const command of intent.payload.commands) {
    for (const device of command.devices) {
      for (const execution of command.execution) {
        // 例外時にもdevice.idが必要なのでここで取得する
        result.ids.push(device.id);
        functions.logger.log('device:',device);
        executePromises.push(
          updateDevice(execution, device.customData.oauth_sub)
              .then((data) => {
                Object.assign(result.states, data);
              })
              .catch((error) => {
                // Google アシスタントから例外の内容が通知される
                // 当然だが対応している内容の例外じゃないと読み上げてくれない
                // https://developers.home.google.com/cloud-to-cloud/intents/errors-exceptions?hl=ja
                result.status = 'ERROR';
                result.errorCode = error.message;
                functions.logger.error('exception result', result);
              })
        );
      }
    }
  }

  await Promise.all(executePromises);
  return {
    requestId: requestId,
    payload: {
      commands: [result],
    },
  };
});

app.onDisconnect((body, headers) => {
  // ユーザーがunlinked操作を行ったときに呼び出される
  // 不特定多数に公開する場合データ削除などの処理を書くと良いかも？
  functions.logger.log('User account unlinked from Google Assistant');
  // Return empty response
  return {};
});

exports.smarthome = functions.https.onRequest(app);

// 更新時に呼び出されていると思う関数
// （よくわかってない）
exports.requestsync = functions.https.onRequest(async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  functions.logger.info(`Request SYNC for user ${USER_ID}`);
  try {
    const res = await homegraph.devices.requestSync({
      requestBody: {
        agentUserId: USER_ID,
      },
    });
    functions.logger.info('Request sync response:', res.status, res.data);
    response.json(res.data);
  } catch (err) {
    functions.logger.error(err);
    response.status(500).send(`Error requesting sync: ${err}`);
  }
});
