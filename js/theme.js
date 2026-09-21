// Datasæt der er markeret med themeVar henter deres farve fra CSS-variablen igen,
// så graflinjerne skifter med, når temaet skifter.
function refreshDatasetColors(chartInstance){
    chartInstance.data.datasets.forEach(ds => {
        if(!ds.themeVar) return;
        const color = getCSSVar(ds.themeVar);
        ds.borderColor = color;
        ds.backgroundColor = color;
    });
}

function applyLineChartTheme(chartInstance){
    if(!chartInstance) return;
    refreshDatasetColors(chartInstance);
    const gridColor = getCSSVar('--chart-grid');
    const tickColor = getCSSVar('--muted');
    const tooltipBg = getCSSVar('--tooltip-bg');
    const tooltipBorder = getCSSVar('--border');
    const textColor = getCSSVar('--text');

    chartInstance.options.scales.x.grid.color = gridColor;
    chartInstance.options.scales.x.ticks.color = tickColor;
    if(chartInstance.options.scales.x.title) chartInstance.options.scales.x.title.color = tickColor;
    chartInstance.options.scales.y.grid.color = gridColor;
    chartInstance.options.scales.y.ticks.color = tickColor;
    chartInstance.options.plugins.tooltip.backgroundColor = tooltipBg;
    chartInstance.options.plugins.tooltip.borderColor = tooltipBorder;
    chartInstance.options.plugins.tooltip.titleColor = textColor;
    chartInstance.options.plugins.tooltip.bodyColor = textColor;
    chartInstance.update();
}

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

function applyAllChartThemes(){
    [chart, chart2, chart3, netWorthHistoryChart, ptChart1, ptChart2, ptChart3, ptChart4].forEach(applyLineChartTheme);
    [budgetChart, netWorthChart].forEach(applyDoughnutChartTheme);
}

function setTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    applyAllChartThemes();
}

document.getElementById('lightTheme').addEventListener('change', () => {
    setTheme(document.getElementById('lightTheme').checked ? 'light' : 'dark');
});

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