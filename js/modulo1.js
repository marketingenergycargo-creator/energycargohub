import { getModulo1 } from './api.js';


async function initModulo1() {

    try {

        const data = await getModulo1();

        console.log(data);

        renderTabla(data);

    } catch (error) {

        console.error(
            'Error modulo1:',
            error
        );

    }

}


function renderTabla(data) {

    const tabla =
        document.getElementById('tabla');

    if (!tabla) return;

    let html = `

        <table border="1" cellpadding="10">

            <thead>
                <tr>
                    <th># COT</th>
                    <th>EJECUTIVO</th>
                    <th>EMPRESA</th>
                    <th>STATUS</th>
                </tr>
            </thead>

            <tbody>
    `;


    data.slice(0, 20).forEach(item => {

        html += `

            <tr>
                <td>${item['# COT'] ?? ''}</td>
                <td>${item['EJECUTIVO'] ?? ''}</td>
                <td>${item['EMPRESA'] ?? ''}</td>
                <td>${item['STATUS'] ?? ''}</td>
            </tr>

        `;

    });


    html += `
            </tbody>
        </table>
    `;

    tabla.innerHTML = html;

}


window.addEventListener(
    'DOMContentLoaded',
    initModulo1
);