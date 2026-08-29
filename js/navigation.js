function showTool(n){
    document.getElementById('tool1').style.display = n===1 ? 'block' : 'none';
    document.getElementById('tool2').style.display = n===2 ? 'block' : 'none';
    document.getElementById('tool3').style.display = n===3 ? 'block' : 'none';
    document.getElementById('tool4').style.display = n===4 ? 'block' : 'none';
    document.getElementById('tabBtn1').classList.toggle('active', n===1);
    document.getElementById('tabBtn2').classList.toggle('active', n===2);
    document.getElementById('tabBtn3').classList.toggle('active', n===3);
    document.getElementById('tabBtn4').classList.toggle('active', n===4);

    const ddRow = document.getElementById('doubleDeductionRow');
    if(n===1){
        document.getElementById('payTaxExternally').closest('.toggle-row').insertAdjacentElement('afterend', ddRow);
    } else if(n===2){
        document.getElementById('tool2InflationRow').insertAdjacentElement('afterend', ddRow);
    }
    ddRow.style.display = (n===1 || n===2) ? 'flex' : 'none';

    if(n===1) chart.resize();
    if(n===2) chart2.resize();
    if(n===3) chart3.resize();
    if(n===4){ ptChart1.resize(); ptChart2.resize(); ptChart3.resize(); ptChart4.resize(); }
}

showTool(1);

function showSection(name){
    document.getElementById('section-tools').style.display = name==='tools' ? 'block' : 'none';
    document.getElementById('section-budget').style.display = name==='budget' ? 'block' : 'none';
    document.getElementById('section-formue').style.display = name==='formue' ? 'block' : 'none';
    document.getElementById('topTabBtn1').classList.toggle('active', name==='tools');
    document.getElementById('topTabBtn2').classList.toggle('active', name==='budget');
    document.getElementById('topTabBtn3').classList.toggle('active', name==='formue');

    if(name==='tools'){
        const tool1Visible = document.getElementById('tool1').style.display !== 'none';
        const tool2Visible = document.getElementById('tool2').style.display !== 'none';
        const tool3Visible = document.getElementById('tool3').style.display !== 'none';
        if(tool1Visible){ chart.resize(); }
        else if(tool2Visible){ chart2.resize(); }
        else if(tool3Visible){ chart3.resize(); }
        else { ptChart1.resize(); ptChart2.resize(); ptChart3.resize(); ptChart4.resize(); }
    }
    if(name==='budget'){ budgetChart.resize(); }
    if(name==='formue'){ netWorthChart.resize(); netWorthHistoryChart.resize(); }
}

function dismissIntroBanner(){
    document.getElementById('introBanner').style.display = 'none';
    localStorage.setItem('hasSeenIntroBanner', 'true');
}

if(!localStorage.getItem('hasSeenIntroBanner')){
    document.getElementById('introBanner').style.display = 'flex';
}

function toggleSettings(){
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

document.getElementById('doubleDeduction').addEventListener('change', () => {
    doubleDeductionEnabled = document.getElementById('doubleDeduction').checked;
    update();
    update2();
});