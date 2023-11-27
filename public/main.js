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

const temperatureSetpointInput = document.getElementById('temperature-setpoint-input');
const thermostatModeSelect = document.getElementById('thermostat-mode-select');

function SmartHome() {
  document.addEventListener('DOMContentLoaded', function () {
    this.userWelcome = document.getElementById('user-welcome');
    this.washer = document.getElementById('demo-washer');
    this.requestSync = document.getElementById('request-sync');
    this.requestSync.addEventListener('click', async () => {
      try {
        const response = await fetch('/requestsync');
        console.log(response.status == 200 ?
          'Request SYNC success!' : `Request SYNC unexpected status: ${response.status}`);
      } catch (err) {
        console.error('Request SYNC error', err);
      }
    });
    this.initWasher();
    this.initAuthentication(); // 追加: Firebase Authenticationの初期化
  }.bind(this));
}

SmartHome.prototype.initWasher = function() {
  console.log("Checking user authentication status...");
  // 追加: ユーザーがログインしているか確認
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      this.uid = user.uid;
      this.userWelcome = document.getElementById('user-welcome');
      this.userWelcome.innerHTML = "Welcome " + user.displayName + "!";
      this.handleData();
      this.washer.style.display = "block";
      this.updateButton = document.getElementById('demo-washer-update');
      this.updateButton.addEventListener('click', this.updateState.bind(this));
    } else {
      console.log("User is not logged in.");
      // ログインしていない場合の処理を追加することもできます。
    }
  });
};

SmartHome.prototype.initAuthentication = function() {
  // 追加: Google認証プロバイダのインスタンスを作成
  const googleAuthProvider = new firebase.auth.GoogleAuthProvider();

  // 追加: Googleログインボタンがクリックされたときの処理
  const googleLoginButton = document.getElementById('google-login-button');
  googleLoginButton.addEventListener('click', () => {
    console.log("Initiating Google login...");
    // Googleログインのポップアップを開く
    firebase.auth().signInWithPopup(googleAuthProvider).then(function (result) {
    // ログイン成功時の処理（ここで必要ならばデータの読み取り等を行う）
    console.log("Google login success:", result.user);
    // IDトークンを取得
    result.user.getIdToken().then(function (idToken) {
      console.log('IDトークン:', idToken);

    }).catch(function (error) {
      console.error('IDトークン取得エラー:', error);
    });

    }).catch((error) => {
      console.error("Google login error:", error);
    });
  });

  // 追加: ログアウトボタンがクリックされたときの処理
  const logoutButton = document.getElementById('logout-button');
  logoutButton.addEventListener('click', () => {
    console.log("Logging out...");
    firebase.auth().signOut().then(() => {
      console.log("User logged out.");
      // ログアウト成功時の処理（ここで必要ならば画面の更新等を行う）
    }).catch((error) => {
      console.error("Logout error:", error);
    });
  });
};

SmartHome.prototype.handleData = () => {

  firebase.database().ref('/').child('thermostat').on("value", (snapshot) => {
    if (snapshot.exists()) {
      const thermostatState = snapshot.val();
      console.log(thermostatState);

      temperatureSetpointInput.value = thermostatState.data.temperatureSetpoint;
      thermostatModeSelect.value = thermostatState.data.thermostatMode;
    }
  });
};

SmartHome.prototype.updateState = () => {

  const pkg = {
    temperatureSetpoint: parseFloat(temperatureSetpointInput.value),
    thermostatMode: thermostatModeSelect.value
  };

  console.log(pkg);
  firebase.database().ref('/').child('thermostat').set(pkg);
};

window.smarthome = new SmartHome();
