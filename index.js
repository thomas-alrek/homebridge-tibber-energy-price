const PackageJson = require('./package.json')
const { TibberQuery } = require('tibber-api')

let Service, Characteristic, api;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    api = homebridge
    homebridge.registerAccessory(PackageJson.name, "TibberEnergyPrice", TibberEnergyPrice)
};

function TibberEnergyPrice(log, config) {
    this.log = log;
    this.name = config.name;
    this.currentPrice = null
    this.minSensorValue = 0
    this.maxSensorValue = 65536
    const tibber = new TibberQuery({
        apiEndpoint: {
            apiKey: config.apiToken,
            queryUrl: 'https://api.tibber.com/v1-beta/gql'
        },
    });
    this.homebridgeService = new Service.LightSensor(this.name)
    this.homebridgeService
        .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
        .setProps({ minValue: this.minSensorValue, maxValue: this.maxSensorValue })
        .on('get', this.getSensorValue.bind(this))

    this.identify = callback => {
        this.log.info('Identify requested')
        callback(null)
    }

    this.getServices = () => {
        const informationService = new Service.AccessoryInformation();

        informationService
            .setCharacteristic(Characteristic.Manufacturer, PackageJson.author.name)
            .setCharacteristic(Characteristic.Model, PackageJson.name)
            .setCharacteristic(Characteristic.SerialNumber, '001')
            .setCharacteristic(Characteristic.FirmwareRevision, PackageJson.version);

        return [informationService, this.homebridgeService];
    },

        this.getSensorValue = async (callback) => {
            this.currentPrice = await tibber.getCurrentEnergyPrice(config.apiHomeId)
            callback(null, Math.ceil(this.currentPrice.total * 100))
        }
}
