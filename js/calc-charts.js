document.addEventListener('DOMContentLoaded', function() {
  // グラフ描画
  const ctx = document.getElementById('scoreChart').getContext('2d');

  // Define the data points based on the table
  const dataPoints = [
    { x: 950000, y: -1.67 },    // AAA start
    { x: 975000, y: 0.0 },      // S start
    { x: 990000, y: 0.6 },      // S+ start
    { x: 1000000, y: 1.0 },     // SS start
    { x: 1005000, y: 1.5 },     // SS+ start
    { x: 1007500, y: 2.0 },     // SSS start
    { x: 1009000, y: 2.15 },    // SSS+ start
    { x: 1010000, y: 2.25 }     // MAX
  ];

  new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'スコア補正値',
        data: dataPoints,
        borderColor: '#00e5ff',
        backgroundColor: 'rgba(0, 229, 255, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#00e5ff',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0 // Straight lines between points
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return '補正値: ' + (context.parsed.y > 0 ? '+' : '') + context.parsed.y;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'スコア',
            color: '#aaa'
          },
          min: 950000,
          max: 1010000,
          ticks: {
            color: '#ddd',
            callback: function(value) {
              return value.toLocaleString(); // Add commas
            },
            stepSize: 10000
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        y: {
          title: {
            display: true,
            text: 'スコア補正値',
            color: '#aaa'
          },
          ticks: {
            color: '#ddd'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            zeroLineColor: 'rgba(255, 255, 255, 0.3)'
          }
        }
      }
    }
  });

  // --- Theory AJC-FORCE Chart ---
  const theoryCtx = document.getElementById('theoryChart').getContext('2d');
  // Generate points for Const from 10.0 to 16.0
  const theoryDataPoints = [];
  for(let c = 10.0; c <= 16.0; c += 0.5) {
    const force = Math.pow(c / 15.0, 2) * 2.0;
    theoryDataPoints.push({ x: c, y: parseFloat(force.toFixed(3)) });
  }

  new Chart(theoryCtx, {
    type: 'line',
    data: {
      datasets: [{
        label: '単曲AJC-FORCE',
        data: theoryDataPoints,
        borderColor: '#bd93f9', // Using a purple/pink accent like the AJC badge
        backgroundColor: 'rgba(189, 147, 249, 0.1)',
        borderWidth: 2,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#bd93f9',
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4 // Smooth curve since it's an x^2 function
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              return '定数: ' + context[0].parsed.x.toFixed(1);
            },
            label: function(context) {
              return 'AJC-FORCE: ' + context.parsed.y.toFixed(3);
            }
          }
        }
      },
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: '譜面定数 (Const)',
            color: '#aaa'
          },
          min: 10.0,
          max: 16.0,
          ticks: {
            color: '#ddd',
            stepSize: 0.5,
            callback: function(value) {
              return value.toFixed(1);
            }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        y: {
          title: {
            display: true,
            text: '単曲AJC-FORCE',
            color: '#aaa'
          },
          min: 0,
          max: 2.4,
          ticks: {
            color: '#ddd'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)',
            zeroLineColor: 'rgba(255, 255, 255, 0.3)'
          }
        }
      }
    }
  });
});
