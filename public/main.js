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

function SmartHome() {
  document.addEventListener('DOMContentLoaded', function () {
    this.denyButton = document.getElementById('demo-deny-button');
    this.userWelcome = document.getElementById('user-welcome');
    this.updateButton = document.getElementById('demo-washer-update');
    this.updateButton.addEventListener('click', this.updateState.bind(this));
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
    this.initFirebase();
    this.initWasher();
  }.bind(this));
}

SmartHome.prototype.initFirebase = () => {
  console.log("Initialized Firebase");
};

SmartHome.prototype.initWasher = function() {
  console.log("Logged in as default user");
  this.uid = "123";
  this.userWelcome = document.getElementById('user-welcome'); // userWelcomeを取得する
  this.userWelcome.innerHTML = "Welcome user 123!";
  this.handleData();
  this.washer.style.display = "block";
};


SmartHome.prototype.setToken = (token) => {
  document.cookie = '__session=' + token + ';max-age=3600';
};

SmartHome.prototype.handleData = () => {
  const uid = this.uid;
  const temperatureSetpointInput = document.getElementById('temperature-setpoint-input');
  const thermostatModeSelect = document.getElementById('thermostat-mode-select');

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
  const temperatureSetpointInput = document.getElementById('temperature-setpoint-input');
  const thermostatModeSelect = document.getElementById('thermostat-mode-select');

  const pkg = {
    data: {
      temperatureSetpoint: parseFloat(temperatureSetpointInput.value),
      thermostatMode: thermostatModeSelect.value
    }
  };

  console.log(pkg);
  firebase.database().ref('/').child('thermostat').set(pkg);
};

window.smarthome = new SmartHome();