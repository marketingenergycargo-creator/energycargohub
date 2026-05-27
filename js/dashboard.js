import { getKPIs } from './api.js';


async function initDashboard() {

    try {

        const data = await getKPIs();

        console.log('KPIs:', data);

        document.getElementById('kpiTotal')
            .innerText =
            data.totalCotizaciones ?? 0;

        document.getElementById('kpiCloseRate')
            .innerText =
            `${data.tasaCierre ?? 0}%`;

        document.getElementById('kpiProfit')
            .innerText =
            `$${Number(
                data.profitTotal ?? 0
            ).toLocaleString()}`;

        document.getElementById('kpiPending')
            .innerText =
            data.pendientes24h ?? 0;

        document.getElementById('kpiNoFeedback')
            .innerText =
            data.sinFeedback ?? 0;

    } catch (error) {

        console.error(
            'Error dashboard:',
            error
        );

    }

}


window.addEventListener(
    'DOMContentLoaded',
    initDashboard
);