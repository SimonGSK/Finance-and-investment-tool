function getCSSVar(name){
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function applyLineChartTheme(chartInstance){
    if(!chartInstance) return;
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

const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
if(savedTheme === 'light'){
    document.getElementById('lightTheme').checked = true;
}
applyAllChartThemes();