/**
 * @file Lyst/mørkt tema: læser det gemte valg (ellers systemets), skifter tema
 * og gentegner alle grafer, så deres farver og skrifttyper følger med.
 */

/**
 * Datasæt, der er markeret med `themeVar`, får deres farve læst fra CSS-variablen
 * igen, så graflinjerne skifter med, når temaet skifter.
 * @param {import('chart.js').Chart} chartInstance
 */
function refreshDatasetColors(chartInstance){
    chartInstance.data.datasets.forEach(ds => {
        if(!ds.themeVar) return;
        const color = getCSSVar(ds.themeVar);
        ds.borderColor = color;
        ds.backgroundColor = color;
    });
}

/**
 * Sætter grid-, akse-, tooltip- og seriefarver på en linjegraf ud fra det
 * aktuelle tema og tegner den igen. Ignorerer null (grafer, der ikke er lavet endnu).
 * @param {import('chart.js').Chart|null} chartInstance
 */
function applyLineChartTheme(chartInstance){
    if(!chartInstance) return;
    refreshDatasetColors(chartInstance);
    const gridColor = getCSSVar('--chart-grid');
    const tickColor = getCSSVar('--muted');
    const tooltipBg = getCSSVar('--tooltip-bg');
    const tooltipBorder = getCSSVar('--border');
    const textColor = getCSSVar('--text');

    Object.values(chartInstance.options.scales || {}).forEach(scale => {
        if(scale.grid && scale.grid.drawOnChartArea !== false) scale.grid.color = gridColor;
        if(scale.ticks) scale.ticks.color = tickColor;
        if(scale.title) scale.title.color = tickColor;
    });
    chartInstance.options.plugins.tooltip.backgroundColor = tooltipBg;
    chartInstance.options.plugins.tooltip.borderColor = tooltipBorder;
    chartInstance.options.plugins.tooltip.titleColor = textColor;
    chartInstance.options.plugins.tooltip.bodyColor = textColor;
    chartInstance.update();
}

/**
 * Som applyLineChartTheme, men for doughnut-graferne (legend, tooltip og
 * kanten mellem lagkagestykkerne).
 * @param {import('chart.js').Chart|null} chartInstance
 */
function applyDoughnutChartTheme(chartInstance){
    if(!chartInstance) return;
    const tickColor = getCSSVar('--muted');
    const tooltipBg = getCSSVar('--tooltip-bg');
    const tooltipBorder = getCSSVar('--border');
    const textColor = getCSSVar('--text');
    const sliceBorder = getCSSVar('--panel');

    chartInstance.options.plugins.legend.labels.color = tickColor;
    chartInstance.options.plugins.tooltip.backgroundColor = tooltipBg;
    chartInstance.options.plugins.tooltip.borderColor = tooltipBorder;
    chartInstance.options.plugins.tooltip.titleColor = textColor;
    chartInstance.options.plugins.tooltip.bodyColor = textColor;
    chartInstance.data.datasets[0].borderColor = sliceBorder;
    chartInstance.update();
}

/**
 * Gentegner samtlige grafer på siden med det aktuelle tema.
 */
function applyAllChartThemes(){
    Object.values(Chart.instances).forEach(c =>
        c.config.type === 'doughnut' ? applyDoughnutChartTheme(c) : applyLineChartTheme(c));
}

/**
 * Skifter tema, gemmer valget, og gentegner graferne.
 * @param {'light'|'dark'} theme
 */
function setTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    applyAllChartThemes();
}

document.getElementById('lightTheme').addEventListener('change', () => {
    setTheme(document.getElementById('lightTheme').checked ? 'light' : 'dark');
});

/**
 * @returns {'light'|'dark'} det tema, styresystemet foretrækker lige nu
 */
function getSystemTheme(){
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const storedTheme = localStorage.getItem('theme');
const savedTheme = storedTheme || getSystemTheme();
document.documentElement.setAttribute('data-theme', savedTheme);
if(savedTheme === 'light'){
    document.getElementById('lightTheme').checked = true;
}
applyAllChartThemes();

// Canvas-tekst tegnes med den skrifttype, der er klar i det øjeblik grafen tegnes.
// Graferne tegnes første gang før webfontene er hentet, så gentegn dem, når
// fontene er klar - ellers sidder aksetekster og legender fast i fallback-skriften.
document.fonts.ready.then(applyAllChartThemes);

// Så længe brugeren IKKE selv har valgt et tema manuelt (dvs. intet gemt endnu),
// følger siden systemets tema live - også hvis man skifter det, mens siden er åben.
if(!storedTheme){
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        if(localStorage.getItem('theme')) return; // brugeren har nu valgt manuelt undervejs - stop med at følge
        const theme = e.matches ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        document.getElementById('lightTheme').checked = (theme === 'light');
        applyAllChartThemes();
    });
}