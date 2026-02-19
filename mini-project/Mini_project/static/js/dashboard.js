// ==================== GLOBAL VARIABLES ====================
let charts = {};
let currentFilter = 'all';
let machinesData = [];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    loadDashboardData();
    setupPredictionForm();
    
    // Auto-refresh every 30 seconds
    setInterval(refreshData, 30000);
});

// ==================== NAVIGATION ====================
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding section
            const sectionId = this.dataset.section + '-section';
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(sectionId).classList.add('active');
            
            // Load section-specific data
            if (sectionId === 'machines-section') {
                loadMachinesAtRisk();
            } else if (sectionId === 'analytics-section') {
                loadAnalytics();
            }
        });
    });
}

// ==================== DATA LOADING ====================
function loadDashboardData() {
    updateLastUpdateTime();
    loadOverview();
    loadMachinesAtRisk();
    loadFeatureAnalysis();
}

function refreshData() {
    loadDashboardData();
    showNotification('Data refreshed successfully', 'success');
}

async function loadOverview() {
    try {
        const response = await fetch('/api/overview');
        const data = await response.json();
        
        // Update KPI cards
        document.getElementById('total-machines').textContent = data.total_machines;
        document.getElementById('healthy-machines').textContent = data.healthy_machines;
        document.getElementById('at-risk-machines').textContent = data.at_risk_machines;
        document.getElementById('avg-health').textContent = data.avg_health_score + '%';
        
        // Update charts
        updateRiskDistributionChart(data.risk_distribution);
        updateHealthStatusChart(data.healthy_machines, data.at_risk_machines);
        
    } catch (error) {
        console.error('Error loading overview:', error);
        showNotification('Error loading overview data', 'error');
    }
}

async function loadMachinesAtRisk() {
    try {
        const response = await fetch('/api/machines_at_risk');
        const data = await response.json();
        machinesData = data.machines;
        
        displayMachines(machinesData);
        setupFilterButtons();
        
    } catch (error) {
        console.error('Error loading machines:', error);
        showNotification('Error loading machines data', 'error');
    }
}

async function loadFeatureAnalysis() {
    try {
        const response = await fetch('/api/feature_analysis');
        const data = await response.json();
        
        updateCorrelationChart(data.correlations);
        
    } catch (error) {
        console.error('Error loading feature analysis:', error);
    }
}

async function loadAnalytics() {
    try {
        const timeSeriesResponse = await fetch('/api/time_series');
        const timeSeriesData = await timeSeriesResponse.json();
        
        updateTimeSeriesChart(timeSeriesData.time_series);
        
        // Load additional analytics
        const featureResponse = await fetch('/api/feature_analysis');
        const featureData = await featureResponse.json();
        
        updateTemperatureChart(featureData.statistics);
        updateToolWearChart(featureData.statistics);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// ==================== CHART UPDATES ====================
function updateRiskDistributionChart(riskData) {
    const ctx = document.getElementById('riskDistributionChart');
    
    if (charts.riskDistribution) {
        charts.riskDistribution.destroy();
    }
    
    charts.riskDistribution = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Low Risk', 'Medium Risk', 'High Risk'],
            datasets: [{
                data: [riskData.low, riskData.medium, riskData.high],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 15,
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

function updateHealthStatusChart(healthy, atRisk) {
    const ctx = document.getElementById('healthStatusChart');
    
    if (charts.healthStatus) {
        charts.healthStatus.destroy();
    }
    
    charts.healthStatus = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Healthy', 'At Risk'],
            datasets: [{
                label: 'Number of Machines',
                data: [healthy, atRisk],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            }
        }
    });
}

function updateCorrelationChart(correlations) {
    const ctx = document.getElementById('correlationChart');
    
    if (charts.correlation) {
        charts.correlation.destroy();
    }
    
    const labels = Object.keys(correlations);
    const values = Object.values(correlations);
    
    charts.correlation = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(l => l.replace(/\[.*?\]/g, '').substring(0, 30)),
            datasets: [{
                label: 'Correlation with Failure',
                data: values,
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                borderRadius: 6
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 1,
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' }
                },
                y: {
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 11 }
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

function updateTimeSeriesChart(timeSeriesData) {
    const ctx = document.getElementById('timeSeriesChart');
    
    if (charts.timeSeries) {
        charts.timeSeries.destroy();
    }
    
    const labels = timeSeriesData.map(d => d.period);
    
    charts.timeSeries = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temperature (K)',
                    data: timeSeriesData.map(d => d.avg_temperature),
                    borderColor: 'rgba(239, 68, 68, 1)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Rotational Speed (rpm)',
                    data: timeSeriesData.map(d => d.avg_rotational_speed / 10),
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Torque (Nm)',
                    data: timeSeriesData.map(d => d.avg_torque),
                    borderColor: 'rgba(245, 158, 11, 1)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        padding: 15,
                        usePointStyle: true
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            }
        }
    });
}

function updateTemperatureChart(statistics) {
    const ctx = document.getElementById('temperatureChart');
    
    if (charts.temperature) {
        charts.temperature.destroy();
    }
    
    const tempKey = 'Air temperature [K]';
    const tempData = statistics[tempKey] || { mean: 0, std: 0, min: 0, max: 0 };
    
    charts.temperature = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Min', 'Mean', 'Max'],
            datasets: [{
                label: 'Temperature (K)',
                data: [tempData.min, tempData.mean, tempData.max],
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            }
        }
    });
}

function updateToolWearChart(statistics) {
    const ctx = document.getElementById('toolWearChart');
    
    if (charts.toolWear) {
        charts.toolWear.destroy();
    }
    
    const wearKey = 'Tool wear [min]';
    const wearData = statistics[wearKey] || { mean: 0, std: 0, min: 0, max: 0 };
    
    charts.toolWear = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Minimum Wear', 'Average Wear', 'Maximum Wear'],
            datasets: [{
                data: [wearData.min, wearData.mean - wearData.min, wearData.max - wearData.mean],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 15,
                        font: { size: 11 }
                    }
                }
            }
        }
    });
}

// ==================== TABLE FUNCTIONS ====================
function displayMachines(machines) {
    const tbody = document.getElementById('machines-table-body');
    
    if (machines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="loading">No machines at risk</td></tr>';
        return;
    }
    
    tbody.innerHTML = machines.map(machine => `
        <tr data-risk="${machine.risk_level.toLowerCase()}">
            <td>${machine.id}</td>
            <td>${machine.product_id}</td>
            <td>${machine.type}</td>
            <td><span class="risk-badge risk-${machine.risk_level.toLowerCase()}">${machine.risk_level}</span></td>
            <td>${machine.risk_score}%</td>
            <td>${machine.temperature}</td>
            <td>${machine.rotational_speed}</td>
            <td>${machine.torque}</td>
            <td>${machine.tool_wear}</td>
            <td><button class="action-btn" onclick="scheduleMaintenance('${machine.id}')">Schedule</button></td>
        </tr>
    `).join('');
}

function setupFilterButtons() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.dataset.filter;
            filterMachines(filter);
        });
    });
}

function filterMachines(filter) {
    currentFilter = filter;
    
    if (filter === 'all') {
        displayMachines(machinesData);
    } else {
        const filtered = machinesData.filter(m => m.risk_level.toLowerCase() === filter);
        displayMachines(filtered);
    }
}

function scheduleMaintenance(machineId) {
    showNotification(`Maintenance scheduled for Machine ${machineId}`, 'success');
}

// ==================== PREDICTION FORM ====================
function setupPredictionForm() {
    const form = document.getElementById('prediction-form');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = {
            'Air temperature [K]': parseFloat(document.getElementById('air-temp').value),
            'Process temperature [K]': parseFloat(document.getElementById('process-temp').value),
            'Rotational speed [rpm]': parseFloat(document.getElementById('rotational-speed').value),
            'Torque [Nm]': parseFloat(document.getElementById('torque').value),
            'Tool wear [min]': parseFloat(document.getElementById('tool-wear').value)
        };
        
        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const result = await response.json();
            displayPredictionResult(result);
            
        } catch (error) {
            console.error('Error making prediction:', error);
            showNotification('Error making prediction', 'error');
        }
    });
}

function displayPredictionResult(result) {
    const resultDiv = document.getElementById('prediction-result');
    
    const statusClass = result.prediction === 1 ? 'result-risk' : 'result-healthy';
    const statusText = result.status;
    const riskPercentage = (result.probability * 100).toFixed(2);
    
    resultDiv.innerHTML = `
        <h3>Prediction Result</h3>
        <div class="result-content">
            <div class="result-status ${statusClass}">
                ${statusText}
            </div>
            <div class="result-details">
                <div class="result-item">
                    <label>Risk Level</label>
                    <value class="risk-${result.risk_level.toLowerCase()}">${result.risk_level}</value>
                </div>
                <div class="result-item">
                    <label>Failure Probability</label>
                    <value>${riskPercentage}%</value>
                </div>
            </div>
            <p style="margin-top: 1.5rem; color: var(--text-secondary);">
                ${result.prediction === 1 ? 
                    'This machine requires immediate attention. Schedule maintenance as soon as possible.' : 
                    'This machine is operating within normal parameters. Continue regular monitoring.'}
            </p>
        </div>
    `;
}

// ==================== UTILITY FUNCTIONS ====================
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('last-update-time').textContent = timeString;
}

function showNotification(message, type) {
    // Simple notification system
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // You can implement a toast notification here
    // For now, we'll just log to console
}

// Export functions for use in HTML
window.refreshData = refreshData;
window.scheduleMaintenance = scheduleMaintenance;
