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
    this.updateButton = document.getElementById('demo-thermostat-update');
    this.updateButton.addEventListener('click', this.updateState.bind(this));
    this.washer = document.getElementById('demo-thermostat');
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
    this.initThermostat();
  }.bind(this));
}

SmartHome.prototype.initFirebase = function() {
  // Firebaseの初期化処理を記述
  firebase.initializeApp(config);
};

SmartHome.prototype.initThermostat = function() {
  // サーモスタットの初期化処理を記述
  this.thermostat = firebase.database().ref('/thermostat');
  this.thermostat.on("value", this.handleThermostatData.bind(this));
};

SmartHome.prototype.handleThermostatData = function(snapshot) {
  if (snapshot.exists()) {
    const thermostatState = snapshot.val();

    const elOnOff = document.getElementById('demo-thermostat-onOff');
    const elModes = document.getElementById('demo-thermostat-runCycle');

    elOnOff.MaterialSwitch[thermostatState.OnOff.on ? 'on' : 'off']();
    elModes.MaterialSwitch[thermostatState.thermostatMode === 'heat' ? 'on' : 'off']();
  }
};

SmartHome.prototype.updateState = function() {
  const elOnOff = document.getElementById('demo-thermostat-onOff');
  const elModes = document.getElementById('demo-thermostat-runCycle');

  const pkg = {
    OnOff: { on: elOnOff.classList.contains('is-checked') },
    thermostatMode: elModes.classList.contains('is-checked') ? 'heat' : 'off',
  };

  this.thermostat.set(pkg);
};

window.smarthome = new SmartHome();
