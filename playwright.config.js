// Browsertests af hele siden (npm run test:e2e). De rene beregninger testes
// hurtigere med Node (npm test); disse fanger fejl, man kun ser i en browser,
// fx grafer der ikke passer til deres boks.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: 'tests/e2e',
    // Pythons udviklingsserver taber indimellem forespørgsler, når flere browsere
    // henter ~20 filer på én gang - suiten er lille, så den kører én test ad gangen.
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: 'http://localhost:4174',
        trace: 'retain-on-failure'
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
        // Telefoner og tablets: kun testene mærket @mobil. iPhone og iPad i WebKit (Safaris motor),
        // fordi Safari lægger layout anderledes end Chrome - fx fik et panel skærmbred scroll kun dér.
        { name: 'iphone', grep: /@mobil/, use: { ...devices['iPhone 13'] } },
        { name: 'android-small', grep: /@mobil/, use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } } },
        { name: 'ipad', grep: /@mobil/, use: { ...devices['iPad Mini'] } }
    ],
    webServer: {
        command: 'python3 -m http.server 4174',
        url: 'http://localhost:4174/index.html',
        reuseExistingServer: !process.env.CI
    }
});
