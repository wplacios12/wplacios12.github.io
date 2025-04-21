// Inicialización de AOS cuando el documento esté listo
document.addEventListener('DOMContentLoaded', function() {
    AOS.init({
        once: true,
        offset: 200
    });

    // Configuración del gráfico
    const ctx = document.getElementById('energyChart').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [
                {
                    label: 'Geo Biomasa y Otros',
                    borderColor: '#198754',
                    data: [],
                    fill: false
                },
                {
                    label: 'Generación Solar',
                    borderColor: '#ffc107',
                    data: [],
                    fill: false
                },
                {
                    label: 'Generación Eólica',
                    borderColor: '#0d6efd',
                    data: [],
                    fill: false
                },
                {
                    label: 'Generación Hidráulica',
                    borderColor: '#0dcaf0',
                    data: [],
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Consumo de Energías Renovables en Colombia (TWh)'
                },
                legend: {
                    display: true,
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'TWh (Terawatts-hora)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Año'
                    }
                }
            }
        }
    });

    // Variable para almacenar los datos originales
    let originalData = {
        labels: [],
        datasets: []
    };

    // Función para cargar los datos
    async function loadData() {
        try {
            // Cargar ambos archivos CSV
            const [renewableResponse, hydroResponse] = await Promise.all([
                fetch('cvs/02 modern-renewable-energy-consumption.csv'),
                fetch('cvs/05 hydropower-consumption.csv')
            ]);

            const renewableData = await renewableResponse.text();
            const hydroData = await hydroResponse.text();
            
            const renewableRows = renewableData.split('\n');
            const hydroRows = hydroData.split('\n');
            
            // Procesar datos de energía hidráulica de Colombia
            const hydroDataColombia = hydroRows
                .filter(row => row.startsWith('Colombia,COL,'))
                .map(row => {
                    const values = row.split(',');
                    return {
                        year: parseInt(values[2]),
                        hydro: parseFloat(values[3]) || 0
                    };
                });

            // Procesar otros datos renovables de Colombia
            const otherRenewableData = renewableRows
                .filter(row => row.startsWith('Colombia,COL,'))
                .map(row => {
                    const values = row.split(',');
                    return {
                        year: parseInt(values[2]),
                        geoBiomassOther: parseFloat(values[3]) || 0,
                        solar: parseFloat(values[4]) || 0,
                        wind: parseFloat(values[5]) || 0
                    };
                });

            // Combinar los datos
            const colombiaData = otherRenewableData.map(renewable => {
                const hydroYear = hydroDataColombia.find(h => h.year === renewable.year);
                return {
                    year: renewable.year,
                    geoBiomassOther: renewable.geoBiomassOther,
                    solar: renewable.solar,
                    wind: renewable.wind,
                    hydro: hydroYear ? hydroYear.hydro : 0
                };
            }).sort((a, b) => a.year - b.year);

            // Guardar los datos originales después de procesarlos
            originalData.labels = colombiaData.map(d => d.year);
            originalData.datasets = [
                {
                    data: colombiaData.map(d => d.geoBiomassOther),
                    label: 'Geo Biomasa y Otros'
                },
                {
                    data: colombiaData.map(d => d.solar),
                    label: 'Generación Solar'
                },
                {
                    data: colombiaData.map(d => d.wind),
                    label: 'Generación Eólica'
                },
                {
                    data: colombiaData.map(d => d.hydro),
                    label: 'Generación Hidráulica'
                }
            ];

            // Actualizar gráfico con los datos originales
            updateChart(originalData.labels, originalData.datasets);

            // Actualizar tabla
            const tableBody = document.getElementById('dataTable');
            tableBody.innerHTML = colombiaData.map(d => `
                <tr>
                    <td>${d.year}</td>
                    <td>${d.geoBiomassOther.toFixed(4)}</td>
                    <td>${d.solar.toFixed(4)}</td>
                    <td>${d.wind.toFixed(4)}</td>
                    <td>${d.hydro.toFixed(4)}</td>
                </tr>
            `).join('');

            // Actualizar selector de años
            const yearFilter = document.getElementById('yearFilter');
            yearFilter.innerHTML = '<option value="">Todos los años</option>' + 
                colombiaData.map(d => `<option value="${d.year}">${d.year}</option>`).join('');

        } catch (error) {
            console.error('Error cargando los datos:', error);
            const tableBody = document.getElementById('dataTable');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="5">Error cargando los datos: ${error.message}</td>
                    </tr>
                `;
            }
        }
    }

    // Función para actualizar el gráfico
    function updateChart(labels, datasets) {
        chart.data.labels = labels;
        chart.data.datasets.forEach((dataset, i) => {
            dataset.data = datasets[i].data;
        });
        chart.update();
    }

    // Event listeners para los filtros
    document.getElementById('yearFilter').addEventListener('change', function(e) {
        const selectedYear = e.target.value;
        if (selectedYear) {
            const endIndex = originalData.labels.indexOf(parseInt(selectedYear));
            // Mostrar datos desde el inicio hasta el año seleccionado
            const filteredLabels = originalData.labels.slice(0, endIndex + 1);
            const filteredDatasets = originalData.datasets.map(ds => ({
                ...ds,
                data: ds.data.slice(0, endIndex + 1)
            }));
            updateChart(filteredLabels, filteredDatasets);
        } else {
            // Restaurar datos originales
            updateChart(originalData.labels, originalData.datasets);
        }
    });

    document.getElementById('energyTypeFilter').addEventListener('change', function(e) {
        const selectedType = e.target.value.toLowerCase();
        chart.data.datasets.forEach(dataset => {
            if (selectedType === '') {
                dataset.hidden = false;
            } else {
                // Modificar la lógica de comparación para los tipos de energía
                const datasetLabel = dataset.label.toLowerCase();
                dataset.hidden = !(
                    (selectedType === 'eolica' && datasetLabel.includes('eólica')) ||
                    (selectedType === 'hidraulica' && datasetLabel.includes('hidráulica')) ||
                    (selectedType === 'solar' && datasetLabel.includes('solar')) ||
                    (selectedType === 'geo' && datasetLabel.includes('geo biomasa'))
                );
            }
        });
        chart.update();
    });

    // Cargar datos iniciales
    loadData();
});