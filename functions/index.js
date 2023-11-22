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
const util = require('util');
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
  const userinfo = await getauth0_userinfo(headers)
  functions.logger.log("auth0_req", userinfo);
  functions.logger.log("set_email", userinfo.email);
  return {
    requestId: body.requestId,
    payload: {
      agentUserId: USER_ID,
      devices: [{
        id: userinfo.email,
        type: 'action.devices.types.THERMOSTAT',
        traits: [
          'action.devices.traits.TemperatureSetting',
          'action.devices.traits.Modes'
        ],
        name: {
          name: 'thermostat',
        },
        willReportState: true,
        attributes: {
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
        deviceInfo: {
          manufacturer: 'hate-ms-inc',
          model: 'esp32-dev-test',
          hwVersion: '1.0',
          swVersion: '1.0.1',
        },
        // TODO: Add otherDeviceIds for local execution
        otherDeviceIds: [{
          deviceId: 'deviceid123',
        }],
      }],
    },
  };
});

const queryFirebase = async (deviceId) => {
  const snapshot = await firebaseRef.child(deviceId).once('value');
  const snapshotVal = snapshot.val();
  return {
    thermostatTemperatureSetpoint: snapshotVal.data.temperatureSetpoint,
    thermostatMode: snapshotVal.data.thermostatMode,
    thermostatTemperatureAmbient: snapshotVal.data.thermostatTemperatureAmbient,
    thermostatHumidityAmbient: snapshotVal.data.thermostatHumidityAmbient,
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
    const deviceId = device.id;
    queryPromises.push(queryFirebase(deviceId)
        .then((data) => {
        // Add response to device payload
          payload.devices[deviceId] = data;
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

const updateDevice = async (execution, deviceId) => {
  const {params, command} = execution;
  functions.logger.log('Request params:', params);
  let state; let ref;
  switch (command) {
    case 'action.devices.commands.ThermostatTemperatureSetpoint':
      state = { temperatureSetpoint: params.thermostatTemperatureSetpoint };
      ref = firebaseRef.child(deviceId).child('data');
      break;
    case 'action.devices.commands.ThermostatSetMode':
      state = { thermostatMode: params.thermostatMode };
      ref = firebaseRef.child(deviceId).child('data');
      break;
  }

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
        executePromises.push(
            updateDevice(execution, device.id)
                .then((data) => {
                  result.ids.push(device.id);
                  Object.assign(result.states, data);
                })
                .catch(() => functions.logger.error('EXECUTE', device.id)),
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
  functions.logger.log('User account unlinked from Google Assistant');
  // Return empty response
  return {};
});

exports.smarthome = functions.https.onRequest(app);

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

/**
 * Send a REPORT STATE call to the homegraph when data for any device id
 * has been changed.
 */
exports.reportstate = functions.database.ref('{deviceId}').onWrite(
    async (change, context) => {
      functions.logger.info('Firebase write event triggered Report State');
      const snapshot = change.after.val();

      const requestBody = {
        requestId: 'ff36a3cc', /* Any unique ID */
        agentUserId: USER_ID,
        payload: {
          devices: {
            states: {
              [context.params.deviceId]: {
                thermostatTemperatureSetpoint: snapshot.data.temperatureSetpoint,
                thermostatMode: snapshot.data.thermostatMode,
                thermostatTemperatureAmbient: snapshot.data.thermostatTemperatureAmbient,
                thermostatHumidityAmbient: snapshot.data.thermostatHumidityAmbient,
              },
            },
          },
        },
      };

      const res = await homegraph.devices.reportStateAndNotification({
        requestBody,
      });
      functions.logger.info('Report state:', requestBody);
      functions.logger.info('Report state response:', res.status, res.data);
    });

/**
 * Update the current state of the washer device
 */
exports.updatestate = functions.https.onRequest((request, response) => {
  firebaseRef.child('thermostat').update({
    "data": {
      "temperatureSetpoint": request.body.temperatureSetpoint,
      "thermostatMode": request.body.thermostatMode,
    },
  });
  return response.status(200).end();
});
