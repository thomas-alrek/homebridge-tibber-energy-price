import PackageJson from './package.json' assert { type: 'json' }
import { TibberQuery } from 'tibber-api'

class Cache {
    constructor(log) {
        this.log = log
        this.storage = []
    }

    has(key) {
        const item = this.storage.find(item => item.key === key)

        if (item) {
            if (Date.now() < item.ttl) {
                return true
            }

            this.forget(key)
        }

        return false
    }

    get(key) {
        if (this.has(key)) {
            const item = this.storage.find(item => item.key === key)
            return item.value
        }

        return null
    }

    set(key, value, ttl = 60000) {
        if (ttl > 0) {
            this.forget(key)
            this.storage.push({ key, value, ttl: Date.now() + ttl })
        }
    }

    forget(key) {
        this.storage = this.storage.filter(item => item.key !== key)
    }
}

class TibberEnergyPrice {
    constructor(log, config, api) {
        this.log = log
        this.config = config
        this.api = api
        this.cache = new Cache(log)

        this.tibber = new TibberQuery({
            apiEndpoint: {
                apiKey: config.apiToken,
                queryUrl: 'https://api.tibber.com/v1-beta/gql'
            },
        })

        this.lightSensorService = new api.hap.Service.LightSensor(this.name)
        this.informationService = new api.hap.Service.AccessoryInformation()

        this.lightSensorService
            .getCharacteristic(api.hap.Characteristic.CurrentAmbientLightLevel)
            .setProps({ minValue: 0, maxValue: 10000 })
            .on('get', async (callback) => callback(null, await this.getSensorValue()))

        this.informationService
            .setCharacteristic(api.hap.Characteristic.Manufacturer, PackageJson.author.name)
            .setCharacteristic(api.hap.Characteristic.Model, PackageJson.name)
            .setCharacteristic(api.hap.Characteristic.SerialNumber, '001')
            .setCharacteristic(api.hap.Characteristic.FirmwareRevision, PackageJson.version)

        this.syncPrice()
    }

    async syncPrice() {
        const sleep = 3600000 - new Date().getTime() % 3600000
        this.log.info(`Will recheck price in ${Math.floor(sleep / 1000)} seconds`)

        setTimeout(async () => {
            this.cache.forget('sensorValue')
            const value = await this.getSensorValue()
            this.lightSensorService.setCharacteristic(this.api.hap.Characteristic.CurrentAmbientLightLevel, value)
            this.syncPrice()
        }, sleep)
    }

    get name() {
        return this.config.name
    }

    identify(callback) {
        callback(null)
    }

    getServices() {
        return [this.informationService, this.lightSensorService];
    }

    async getSensorValue() {
        const cachedValue = this.cache.get('sensorValue')

        if (cachedValue) {
            this.log.info('Using cached sensor value')
            return cachedValue
        }

        const { startsAt, total } = await this.tibber.getCurrentEnergyPrice(this.config.homeId)

        const ttl = new Date(new Date(startsAt).getTime() + 1000 * 60 * 60) - Date.now()
        const value = Math.ceil(total * 100)

        this.log.info('Caching sensor value')
        this.cache.set('sensorValue', value, ttl)

        return value
    }
}

export default (homebridge) => homebridge.registerAccessory(PackageJson.name, 'TibberEnergyPrice', TibberEnergyPrice)