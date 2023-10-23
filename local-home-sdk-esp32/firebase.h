#include <Adafruit_SHT31.h>
#include <Firebase_ESP_Client.h>
#define DATABASE_URL ""
#define WIZNET_RESET_PIN -1
#define WIZNET_CS_PIN 19
#define WIZNET_MISO_PIN 23
#define WIZNET_MOSI_PIN 33
#define WIZNET_SCLK_PIN 22

class FirebaseDataClass {
public:
  void begin();
  void task();
  // static void task(void *pvParameters);
};


Adafruit_SHT31 sht31 = Adafruit_SHT31();

EthernetClient client;

FirebaseDataClass FirebaseData_Class;
FirebaseData fbdo;

FirebaseAuth auth;
FirebaseConfig config;

void FirebaseDataClass::begin() {
  if (!sht31.begin(0x45)) {  // 0x45 is the I2C address of SHT31 sensor
    Serial.println("Could not find a valid SHT31 sensor, check wiring!");
    blinkLED_class.blinkLED(CRGB::Red, 1000);  // Continuous red LED blinking
    ESP.restart();
  }

  config.signer.test_mode = true;

  // Real time data baseのURLを割り当てる
  config.database_url = DATABASE_URL;
  
  fbdo.setEthernetClient(&client, mac_address.mac, WIZNET_CS_PIN, WIZNET_RESET_PIN);

  Firebase.begin(&config, &auth);
}

unsigned long dataMillis = 0;
int count = 0;

void FirebaseDataClass::task() {
  float temperature = sht31.readTemperature();
  float humidity = sht31.readHumidity();

  if (millis() - dataMillis > 60000){
    dataMillis = millis();
    Serial.printf("Set int... %s\n", Firebase.RTDB.setInt(&fbdo, "/thermostat/data/thermostatTemperatureAmbient", temperature) ? "ok" : fbdo.errorReason().c_str());
    Serial.printf("Set int... %s\n", Firebase.RTDB.setInt(&fbdo, "/thermostat/data/thermostatHumidityAmbient", humidity) ? "ok" : fbdo.errorReason().c_str());

    }
}