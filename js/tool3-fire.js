// FIRE-opsparing: rent vækst-loop uden skatteoptimering (der er intet at "høste"
// på en opsparing, man endnu ikke har rørt). Genbruger monthlyReturnFactor() fra
// det månedlige aktiedepot-værktøj.
function computeFireSeries(startCash, monthlyAmount, yearlyReturn, maxYears){
    const monthlyFactor = monthlyReturnFactor(yearlyReturn);
    let value = startCash;
    const series = [{year:0, value:startCash}];
    for(let i=1;i<=maxYears;i++){
        for(let m=1;m<=12;m++){
            value += monthlyAmount;
            value *= monthlyFactor;
        }
        series.push({year:i, value});
    }
    return series;
}

const ctx3 = document.getElementById('chart3').getContext('2d');
let chart3 = new Chart(ctx3, {
    type:'line',
    data:{labels:[], datasets:[
            {label:'Formue', data:[], borderColor:'#E3A548', backgroundColor:'#E3A548', tension:0.15, pointRadius:0, borderWidth:2.5},
            {label:'FIRE-mål', data:[], borderColor:'#5B6B7A', backgroundColor:'#5B6B7A', tension:0.15, pointRadius:0, borderWidth:2, borderDash:[4,4]}
        ]},
    options:{
        responsive:true,
        maintainAspectRatio:false,
        animation:{duration:250},
        interaction:{mode:'index', intersect:false},
        plugins:{
            legend:{display:false},
            tooltip:{
                backgroundColor:'#1C2733',
                borderColor:'#26323F',
                borderWidth:1,
                titleColor:'#EDEAE3',
                bodyColor:'#EDEAE3',
                callbacks:{
                    label: c => `${c.dataset.label}: ${DK.format(c.raw)} kr.`
                }
            }
        },
        scales:{
            x:{
                grid:{color:'#202B36'},
                ticks:{color:'#8B96A3', font:{family:'IBM Plex Mono', size:11}},
                title:{display:true, text:'År', color:'#8B96A3', font:{family:'Inter', size:12}}
            },
            y:{
                grid:{color:'#202B36'},
                ticks:{
                    color:'#8B96A3', font:{family:'IBM Plex Mono', size:11},
                    callback: v => DK.format(v)
                }
            }
        }
    }
});

const expenses3Input = document.getElementById('expenses3');
const startCash3Input = document.getElementById('startCash3');
const monthlyAmount3Input = document.getElementById('monthlyAmount3');
const return3Input = document.getElementById('yearlyReturn3');
const inflation3Input = document.getElementById('inflation3');
const showReal3Input = document.getElementById('showRealValue3');

const FIRE_MAX_YEARS = 60;
const FIRE_WITHDRAWAL_RATE = 4; // 4%-reglen - fast, ikke justerbar

function update3(){
    const expenses = parseInt(expenses3Input.value);
    const startCash = parseInt(startCash3Input.value);
    const monthlyAmount = parseInt(monthlyAmount3Input.value);
    const returnPercent = parseFloat(return3Input.value);
    const yearlyReturn = 1 + returnPercent/100;
    const inflationPercent3 = parseFloat(inflation3Input.value);
    const inflationFactor3 = 1 + inflationPercent3/100;
    const showReal3 = showReal3Input.checked;

    document.getElementById('inflationNote3').style.display = showReal3 ? 'block' : 'none';

    // Dit FIRE-beløb, udtrykt i dagens købekraft - det er jo netop det, "expenses" allerede er.
    const fireNumberBase = expenses / (FIRE_WITHDRAWAL_RATE/100);

    const portfolioNominal = computeFireSeries(startCash, monthlyAmount, yearlyReturn, FIRE_MAX_YEARS);
    // FIRE-målet vokser år for år med inflationen, i nominelle kroner.
    const fireTargetNominal = portfolioNominal.map(p => fireNumberBase * Math.pow(inflationFactor3, p.year));

    // Find det første år, hvor formuen (nominelt) når det (nominelt voksende) mål.
    let yearsToFire = null;
    for(let i=0;i<portfolioNominal.length;i++){
        if(portfolioNominal[i].value >= fireTargetNominal[i]){ yearsToFire = i; break; }
    }

    // Hvor langt skal grafen vise? Lidt luft efter målet er nået, ellers hele horisonten.
    const chartEndYear = yearsToFire !== null ? Math.min(yearsToFire + 5, FIRE_MAX_YEARS) : FIRE_MAX_YEARS;
    const portfolioTrimmed = portfolioNominal.slice(0, chartEndYear+1);
    const targetTrimmed = fireTargetNominal.slice(0, chartEndYear+1);

    const portfolioDisplay = showReal3
        ? portfolioTrimmed.map(p => toRealValue(p.value, p.year, inflationFactor3))
        : portfolioTrimmed.map(p => p.value);
    const targetDisplay = showReal3
        ? targetTrimmed.map((v,i) => toRealValue(v, i, inflationFactor3))
        : targetTrimmed;

    chart3.data.labels = portfolioTrimmed.map(p => p.year);
    chart3.data.datasets[0].data = portfolioDisplay;
    chart3.data.datasets[1].data = targetDisplay;
    chart3.update();

    const tableBody3 = document.getElementById('dataTableBody3');
    tableBody3.innerHTML = portfolioTrimmed.map((p, i) => `<tr>
            <td>${p.year}</td>
            <td>${DK.format(portfolioDisplay[i])} kr.</td>
            <td>${DK.format(targetDisplay[i])} kr.</td>
        </tr>`).join('');

    if(yearsToFire !== null){
        document.getElementById('yearsToFire3').textContent = yearsToFire + ' år';
        document.getElementById('yearsToFireSub3').textContent = '';

        // Formue ved FIRE: det nominelle (fremtidige) beløb, I faktisk vil have på det tidspunkt.
        const valueAtFireNominal = portfolioNominal[yearsToFire].value;
        const valueAtFireReal = toRealValue(valueAtFireNominal, yearsToFire, inflationFactor3);
        document.getElementById('valueAtFire3').textContent = DK.format(valueAtFireNominal) + ' kr.';
        document.getElementById('valueAtFireSub3').textContent = 'svarer til ' + DK.format(valueAtFireReal) + ' kr. i dagens købekraft';

        // Årligt forbrug ved FIRE: hvad de 300.000 kr. (i dagens penge) rent faktisk
        // koster i nominelle kroner det år, I når FIRE.
        const consumptionAtFireNominal = expenses * Math.pow(inflationFactor3, yearsToFire);
        document.getElementById('consumptionAtFire3').textContent = DK.format(consumptionAtFireNominal) + ' kr./år';
        document.getElementById('consumptionAtFireSub3').textContent = 'svarer til ' + DK.format(expenses) + ' kr./år i dagens købekraft';
    } else {
        document.getElementById('yearsToFire3').textContent = FIRE_MAX_YEARS + '+ år';
        document.getElementById('yearsToFireSub3').textContent = 'Ikke nået inden for ' + FIRE_MAX_YEARS + ' år med disse tal';
        document.getElementById('valueAtFire3').textContent = '–';
        document.getElementById('valueAtFireSub3').textContent = '';
        document.getElementById('consumptionAtFire3').textContent = '–';
        document.getElementById('consumptionAtFireSub3').textContent = '';
    }
}

bindSliderAndNumber('expenses3', 'expenses3Number', update3);
bindSliderAndNumber('startCash3', 'startCash3Number', update3);
bindSliderAndNumber('monthlyAmount3', 'monthlyAmount3Number', update3);
bindSliderAndNumber('yearlyReturn3', 'yearlyReturn3Number', update3);
bindSliderAndNumber('inflation3', 'inflation3Number', update3);
showReal3Input.addEventListener('input', update3);

update3();