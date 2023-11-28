#include <Adafruit_SHT31.h>
#include <Firebase_ESP_Client.h>
#define DATABASE_URL "testpro-21356-default-rtdb.firebaseio.com"
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

// 温度・湿度センサーの初期化失敗するとLEDが赤色に数回光りマイコンが再起動
void FirebaseDataClass::begin() {
  if (!sht31.begin(0x45)) {  // 0x45 is the I2C address of SHT31 sensor
    Serial.println("Could not find a valid SHT31 sensor, check wiring!");
    blinkLED_class.blinkLED(CRGB::Red, 1000);  // Continuous red LED blinking
    ESP.restart();
  }
  // 認証なしでアクセスする（テストモード）
  // 少なくとも1分後には値が更新されるので変な値を入れられてもたぶん大丈夫
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
 // 1分待機
  if (millis() - dataMillis > 60000){
    dataMillis = millis();
    // thermostatはユーザーIDへ置き換える(functions/index.jsのuserinfo.subの中身の文字列)
    Serial.printf("Set int... %s\n", Firebase.RTDB.setInt(&fbdo, "/Ambient/google-oauth2|101581906579469553343/thermostatTemperatureAmbient", temperature) ? "ok" : fbdo.errorReason().c_str());
    Serial.printf("Set int... %s\n", Firebase.RTDB.setInt(&fbdo, "/Ambient/google-oauth2|101581906579469553343/thermostatHumidityAmbient", humidity) ? "ok" : fbdo.errorReason().c_str());

    }
}