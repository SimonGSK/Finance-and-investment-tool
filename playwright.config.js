// Browsertests af hele siden (npm run test:e2e). De rene beregninger testes
// hurtigere med Node (npm test); disse fanger fejl, man kun ser i en browser,
// fx grafer der ikke passer til deres boks.
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: 'tests/e2e',
    // Én test ad gangen: testene deler localStorage-opsætning og service worker pr. side,
    // og suiten er lille nok til, at det går hurtigt.
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
        // Vores egen lille Node-server (scripts/serve.js): Pythons http.server tabte
        // indimellem forespørgsler, når siden hentede mange filer på én gang.
        command: 'node scripts/serve.js 4174',
        url: 'http://localhost:4174/index.html',
        reuseExistingServer: !process.env.CI
    }
});
