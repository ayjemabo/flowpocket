const canvas = document.getElementById('budgetCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth * 0.9;
canvas.height = 500;

let data = JSON.parse(localStorage.getItem('budgetData')) || [];

function randomColor() {
  const colors = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc949', '#af7aa1', '#ff9da7'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function saveData() {
  localStorage.setItem('budgetData', JSON.stringify(data));
}

function drawCircles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let total = data.reduce((sum, item) => sum + item.amount, 0);
  let x = 100, y = 250;

  data.forEach((item, i) => {
    const radius = (item.amount / total) * 200 + 20;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = "16px Segoe UI";
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.fillText(item.category, x, y);
    ctx.fillText(item.amount + " USD", x, y + 20);
    x += radius * 2 + 20;
    if (x + radius > canvas.width) {
      x = 100;
      y += 150;
    }
  });
}

document.getElementById('add-btn').addEventListener('click', () => {
  const category = document.getElementById('category').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);

  if (!category || isNaN(amount) || amount <= 0) return alert('Enter valid category and amount');

  data.push({ category, amount, color: randomColor() });
  saveData();
  drawCircles();

  document.getElementById('category').value = '';
  document.getElementById('amount').value = '';
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('Clear all data?')) {
    data = [];
    saveData();
    drawCircles();
  }
});

drawCircles();
