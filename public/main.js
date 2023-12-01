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
// 監視する要素の取得
const temperatureSetpointInput = document.getElementById('temperature-setpoint-input');
const thermostatModeSelect = document.getElementById('thermostat-mode-select');

const googleLoginButton = document.getElementById('google-login-button');
const logoutButton = document.getElementById('logout-button');

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

SmartHome.prototype.initWasher = function () {
  console.log("Checking user authentication status...");
  // ユーザーがログインしているか確認
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // ログインしている場合
      googleLoginButton.style.display = "none";
      logoutButton.style.display = "block";
      this.uid = user.providerData[0].uid;
      this.userWelcome = document.getElementById('user-welcome');
      this.userWelcome.innerHTML = "Welcome " + user.displayName + "!";
      this.washer.style.display = "block";
      // ログイン成功後uidを取得する
      // この方法で取得するとsubと一致するidが入手できる
      const oauth = "google-oauth2|" + user.providerData[0].uid;
      console.log("get oauth uid", oauth);

      SmartHome.prototype.handleData = () => {

        firebase.database().ref('/users').child(oauth).on("value", (snapshot) => {
          if (snapshot.exists()) {
            const thermostatState = snapshot.val();
            console.log(thermostatState);

            temperatureSetpointInput.value = thermostatState.temperatureSetpoint;
            thermostatModeSelect.value = thermostatState.thermostatMode;
          }
        });
      };

      SmartHome.prototype.updateState = () => {

        const pkg = {
          temperatureSetpoint: parseFloat(temperatureSetpointInput.value),
          thermostatMode: thermostatModeSelect.value
        };

        console.log(pkg);
        firebase.database().ref('/users').child(oauth).set(pkg);
      };

      this.handleData();
      this.updateButton = document.getElementById('demo-washer-update');
      this.updateButton.addEventListener('click', this.updateState.bind(this));
      temperatureSetpointInput.addEventListener('change', window.smarthome.updateState.bind(window.smarthome));
      thermostatModeSelect.addEventListener('change', window.smarthome.updateState.bind(window.smarthome));
    } else {
      console.log("User is not logged in.");
      // ログインしていない場合
      googleLoginButton.style.display = "block";
      logoutButton.style.display = "none";
    }
  });
};

SmartHome.prototype.initAuthentication = function () {
  // 追加: Google認証プロバイダのインスタンスを作成
  const googleAuthProvider = new firebase.auth.GoogleAuthProvider();

  // 追加: Googleログインボタンがクリックされたときの処理
  googleLoginButton.addEventListener('click', () => {
    console.log("Initiating Google login...");
    // Googleログインのポップアップを開く
    firebase.auth().signInWithPopup(googleAuthProvider).then(function (result) {
      console.log("Google login success:");
    }).catch((error) => {
      console.error("Google login error:", error);
    });
  });

  // 追加: ログアウトボタンがクリックされたときの処理
  logoutButton.addEventListener('click', () => {
    console.log("Logging out...");
    firebase.auth().signOut().then(() => {
      console.log("User logged out.");
      location.reload()
      // ログアウト成功時の処理（ここで必要ならば画面の更新等を行う）
    }).catch((error) => {
      console.error("Logout error:", error);
    });
  });
};

window.smarthome = new SmartHome();