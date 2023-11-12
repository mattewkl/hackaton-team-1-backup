let cnv;
let maze, child, parent;

// сидит ждет
function Child() {
   this.cell = maze.initCell;

   this.draw = () => {
      circle(this.cell.pos.x, this.cell.pos.y, 5);
   }
}


function Parent() {
   this.cell = maze.endCell;
   this.prevCell = this.cell;

   // Скорость ходьбы родителя. 10 означает одна клетка за 10 кадров
   this.subStepsForOneMove = 10;

   this.subSteps = this.subStepsForOneMove;

   // Попытка сделать шаг. Получает сторону, в какую шагать, и сверяет с connected текущей ячейки
   this.tryMove = (side) => {
      let tryCell = this.cell.connected[side];

      if (tryCell !== 0 && this.subSteps === this.subStepsForOneMove) {
         this.prevCell = this.cell;
         this.cell = tryCell;
         this.subSteps = 0;
         currentStepCount++;
         checkIfGameWon();
      }
   }

   this.draw = () => {
      let amt = this.subSteps / this.subStepsForOneMove;
      let lerpPoint = this.cell.pos;
      if (amt < 1) {
         lerpPoint = lerpPos(this.prevCell.pos, this.cell.pos, amt);
         this.subSteps++;
      }

      circle(lerpPoint.x, lerpPoint.y, 10);
   }
}

function lerpPos(p1, p2, amt) {
   return {
      x: lerp(p1.x, p2.x, amt),
      y: lerp(p1.y, p2.y, amt),
   }
}

function Maze(cellSize, pixelSize) {
   this.cellSize = cellSize;
   this.pixelSize = pixelSize;
   this.cellPixelSize = pixelSize / cellSize;
   this.cells = [];
   this.path = [];
   this.initCell = undefined;
   this.endCell = undefined;
   this.way = [];
   this.pathVisibleAmt = 0;
   this.pathShown = false; //у меня редактор помечает ее как не используемую, но она юзается

   this.getCell = (...args) => {
      if (args.length === 1) {
         let pos = args[0];
         return this.cells[pos.x][pos.y];
      }
      else {
         let x = args[0];
         let y = args[1];
         return this.cells[x][y];
      }
   }

   this.fill = () => {
      for (let i = 0; i < this.cellSize; i++) {
         this.cells.push([]);
         for (let j = 0; j < this.cellSize; j++) {
            this.cells[i].push(new Cell(i, j));
         }
      }
   }

   // отрисовка лабиринта и его анимация
   this.draw = () => {

      // Как долго длится анимация. 36 - 36 кадров
      let duration = 36;

      // насколько выражен центр относительно краев в процессе появления
      // 1 - перепад, при котором когда в центре полоска полная - в углу она половинная.
      let difference = 4;

      // Сюда не лезть, я настраивал это в помутненном сознании и хз, как именно работает формула
      for (let i = 0; i < this.cellSize; i++) {
         for (let j = 0; j < this.cellSize; j++) {
            let c = this.getCell(i, j);
            if (frameCount > duration) {
               c.draw();
               continue;
            }
            let dist = c.gridDistTo(this.initCell);
            let ff = map(frameCount, 0, duration, 0, difference);
            let f = map(
               dist / frameCount,
               0, this.cellSize * 1.41 / 2 / frameCount,
               ff, -difference + 1, true);
            let amt = constrain(f + ff, 0, 1);
            if (amt > 0) c.draw(amt);
         }
      }
   }

   //Тут рисуется анимация пути
   this.drawPath = () => {
      let path = this.way;
      let lenToDraw = path.length;
      if (this.pathVisibleAmt < 1) lenToDraw = path.length * this.pathVisibleAmt;

      // кол-во клеток от кончика пути, на которых цветки уменьшенные
      let smoothEndLen = 5;

      // Размер цветка. Задается относительно размера клетки
      let flowerRelativeSize = 0.15;
      let flowerPixelSize = this.cellPixelSize * flowerRelativeSize;

      let actualSmoothLen = map(lenToDraw,
         path.length - smoothEndLen, path.length,
         smoothEndLen, 0, true);

      //Плотность появления цветков. 0.5 это 2 цветка в клетке.
      let flowerSpawnDensity = 0.47;

      for (let i = 0; i < floor(lenToDraw - 1); i += flowerSpawnDensity) {

         let n = noise(i);
         let a = map(n, 0, 1, 0, TWO_PI);
         let sinA = sin(a);
         let cosA = cos(a);
         let r = map(i, lenToDraw - actualSmoothLen, lenToDraw, flowerPixelSize, 1, true);

         //console.log(lenToDraw, i)
         let cellPos = path[floor(i)].pos;
         let cellNextPos = path[floor(i + 1)].pos;
         let lerpPoint = lerpPos(cellPos, cellNextPos, fract(i));
         drawFlower(lerpPoint.x + sinA * 2, lerpPoint.y + cosA * 2, r);
      }

      // Инкремент приращения пути от 0 до 1.
      // 0.01 означает 100% за 100 кадров.
      this.pathVisibleAmt += 0.01;
   }

   //получает точку, возвращает массив с соседями, которые еще не посещены генератором
   this.getValidNears = (cell) => {
      let x = cell.gridPos.x;
      let y = cell.gridPos.y;
      let around = [
         {side: 0, x: x - 1, y: y, do: [0, 2]},
         {side: 1, x: x, y: y + 1, do: [1, 3]},
         {side: 2, x: x + 1, y: y, do: [2, 0]},
         {side: 3, x: x, y: y - 1, do: [3, 1]}
      ];
      let valid = [];

      for (let l = 0; l < 4; l++) {
         if (around[l].x > -1 &&
             around[l].x < this.cellSize &&
             around[l].y > -1 &&
             around[l].y < this.cellSize) {
            if (this.getCell(around[l]).visited) continue;
            valid.push({...around[l], cell: this.getCell(around[l])});
         }
      }
      return valid;
   }

   // это собственно генератор, его не трогать.
   // в конце генерации сохраняет минимальное количество шагов в глобалку.
   this.generate = () => {
      let x = floor(this.cellSize / 2);
      let y = floor(this.cellSize / 2);
      this.initCell = this.getCell(x, y);
      let cell = this.initCell;
      this.path = [cell];
      cell.visited = true;
      let visitedAmt = 1;
      let totalCells = this.cellSize * this.cellSize;
      while (visitedAmt < totalCells) {
         let around = this.getValidNears(cell);

         if (around.length) {
            let nextPos = around[floor(random() * around.length)];
            let nextCell = nextPos.cell;

            cell.connected[nextPos.do[0]] = nextCell;
            nextCell.connected[nextPos.do[1]] = cell;

            visitedAmt++;
            cell = nextCell;
            cell.visited = true;
            this.path.push(cell);
            let straightDist = Math.hypot(
               cell.gridPos.x - this.initCell.gridPos.x,
               cell.gridPos.y - this.initCell.gridPos.x);
            if (this.path.length > this.way.length * straightDist / 2) {
               this.way = [...this.path];
               this.endCell = cell;
            }
         }
         else {
            this.path.pop();
            cell = this.path.at(-1);
         }
      }
      this.way.reverse();
      minimalStepCount = this.way.length;
   }
}


let globalCellID = 0;

function drawFlower(x, y, r) {
   push()
   let hr = r * 0.75;
   noStroke();
   fill(0, 150, 0);
   circle(x, y, r * 1.5);
   fill(250, 200, 250);
   circle(x + hr, y, r);
   circle(x - hr, y, r);
   circle(x, y + hr, r);
   circle(x, y - hr, r);
   pop()
}

// function bubbleWall(p1, p2, thick = 5) {
//    let amt = 0;
//    let den = 4;
//    let scale = 0.0001;
//    let time = frameCount / 10;
//    for (let i = 1; i < den - 1; i++) {
//       amt = constrain(i / den, 0, 1);
//       let pos = lerpPos(p1, p2, amt);
//
//       let n = noise(pos.x * scale, pos.y * scale);
//       let n2 = noise(time + pos.x * scale, pos.y * scale);
//       let r = map(n, 0, 1, thick * 0.75, thick);
//       let r2 = map(n2, 0, 1, 0, TWO_PI);
//       let c = cos(r2);
//       let s = sin(r2);
//
//       stroke(0, 150, 0);
//       strokeWeight(r);
//       circle(pos.x + s, pos.y + c, 1);
//    }
// }

function Cell(x, y) {
   this.ID = globalCellID++;

   // позиция в массиве
   this.gridPos = {x: x, y: y};

   //Позиция на канвасе в пикселях. Координаты необходимо инвертировать, т.е [y,x] - это правильно. Хз почему
   this.pos = {
      y: maze.cellPixelSize * (x + 0.5),
      x: maze.cellPixelSize * (y + 0.5)
   }
   //Это список соседей точки. В нем либо 0, если стена, либо ссылка на клетку-соседа.
   //Массив ориентирован как [верх, право, низ, лево].
   this.connected = [0, 0, 0, 0];
   this.visited = false;

   this.draw = (amt = 1) => {
      push();
      let size = maze.cellPixelSize;
      let halfSize = size / 2;
      stroke(0, 170, 0);
      strokeWeight(size / 2);
      strokeCap(ROUND);
      noFill();
      translate(this.pos.x, this.pos.y);
      for (let i = 0; i < this.connected.length; i++) {
         if (this.connected[i] === 0) {
            if (this.gridPos.x === 0 || this.gridPos.y === 0 || i === 1 || i === 2) {
               let x1 = -halfSize;
               let x2 = x1 + halfSize * amt * 2;
               line(x1, -halfSize, x2, -halfSize);
            }
         }
         rotate(HALF_PI);
      }
      pop();
   }
   this.gridDistTo = (c) => {
      return Math.hypot(this.gridPos.x - c.gridPos.x, this.gridPos.y - c.gridPos.y)
   }
}

let difficulty = 0;

function play() {
   // это собственно частота кадров
   frameRate(20);
   // это внутренняя переменная p5.js, считает кол-во кадров
   frameCount = 0;
   globalCellID = 0;
   currentStepCount = 0;
   gameStart = true;

   let cellSize = 7;
   if (difficulty === 0) cellSize = 7;
   if (difficulty === 1) cellSize = 11;
   if (difficulty === 2) cellSize = 15;

   maze = new Maze(cellSize, 600);

   //console.log(maze)

   maze.fill();
   maze.generate();

   parent = new Parent();
   child = new Child();

   resizeCanvas(maze.pixelSize, maze.pixelSize, false);
   updateScene();
}

function restart() {
   parent = new Parent();
   currentStepCount = 0;
}

function setup() {
   //randomSeed(10000);
   cnv = createCanvas(0, 0).id("maze");
}

function updateScene() {
   background(0, 100, 30);
   maze.draw();
   if (maze.pathShown) maze.drawPath();
   parent.draw();
   child.draw();
}

function draw() {
   if (!gameStart) return;
   updateScene();
   if (gameOver && maze.pathVisibleAmt >= 1.1) {
      frameRate(0);
      newGame();
   }
}

let gameStart = false;
let gameOver = false;
let currentStepCount = 0; //это можно выводить на экран как количество сделанных ходов
let minimalStepCount;

function keyPressed() {
   if (frameRate() === 0) return;
   if (keyCode === 83) { //S - это старт новой игры, т.е генерация заново, всё вообще в нули.
      gameOver = false;
      play();
   }
   if (keyCode === 88) { //X - это прекращение текущей игры. Рисует цветочки к ребенку и завершает отрисовку.
      gameOver = true;
      maze.pathShown = true;
      showStats();
   }
   if (!gameOver) {
      //R - это рестарт, его можно сделать если игра еще не
      // завершена, просто возвращает родителя на исходную
      if (keyCode === 82) {
         restart();
      }
      if (keyCode === UP_ARROW) {
         parent.tryMove(0);
      }
      if (keyCode === RIGHT_ARROW) {
         parent.tryMove(1);
      }
      if (keyCode === DOWN_ARROW) {
         parent.tryMove(2);
      }
      if (keyCode === LEFT_ARROW) {
         parent.tryMove(3);
      }
   }
   //console.log(keyCode);
}

let startTime;
let endTime;

function checkIfGameWon() {
   if (parent.cell.ID === child.cell.ID) {
      gameWon()
   }
}

function gameWon() {
   gameOver = true;
   WinWindow.classList.remove('no-show');
   hideMenuButton();
   showStats();

}

function newGame() {
   gameOver = false;
   play();
   startTime = new Date().getTime();
}

function handleReadyFrontPageClick() {
   newGame();
   showMenuButton();
   InfoFrontPage.classList.add('no-show')
}


function showStats() {
   statStepsIdeal.innerText = minimalStepCount;
   statStepsCurrent.innerText = currentStepCount + 1;
   endTime = new Date().getTime();
   const Time = new Date(endTime - startTime)
   const Minutes = Time.getMinutes();
   const Seconds = Time.getSeconds();
   statTime.innerText = `${Minutes}:${Seconds}`
}

function hideMenuButton () {
   MenuButton.classList.add('no-show')
   MenuButton.classList.remove('show')
   MenuButton.removeEventListener('click', openMenu)
}

function showMenuButton() {
   MenuButton.classList.remove('no-show')
   MenuButton.classList.add('show')
   MenuButton.addEventListener('click', openMenu)
}

function openMenu() {
   Menu.classList.remove('no-show')
}

function closeMenu() {
   Menu.classList.add('no-show')
}

function handleRestartCurrent() {
   restart();
   closeMenu();
   startTime = new Date().getTime();
}

function handleRestartFull() {
   closeMenu();
   // setTimeout(() => {
   //    newGame();
   // }, 2000);
   gameOver = true;
   maze.pathShown = true;
}

function handleRestartWin () {
   WinWindow.classList.add('no-show')
   InfoFrontPage.classList.remove('no-show')
}

function addListenersOnMenuButtons() {
   RestartCurrentButton.addEventListener('click', handleRestartCurrent)
   RestartFullButton.addEventListener('click', handleRestartFull)
   AfterWinRestartButton.addEventListener('click', handleRestartWin)
   CloseMenuButton.addEventListener('click', closeMenu)
}

// объявление переменных связанных с DOM
const statTime = document.querySelector('.statictic-text_time span')
const statStepsCurrent = document.querySelector('.statictic-text_current-steps span')
const statStepsIdeal = document.querySelector('.statictic-text_ideal-steps span')
const Menu = document.getElementById('info-container-in-game-settings')
const MenuButton = document.querySelector('.open-menu-button')
const CloseMenuButton = document.querySelector('.close-button_menu')
const WinWindow = document.querySelector('.info-container_win')
const AfterWinRestartButton = document.getElementById('after-win-restart-button')
const ReadyButtonFrontPage = document.getElementById('button-start-front-page')
const RestartFullButton = document.getElementById('button-restart-full')
const RestartCurrentButton = document.getElementById('button-restart-current')
const InfoFrontPage = document.getElementById('info-container-front-page')

ReadyButtonFrontPage.addEventListener('click', handleReadyFrontPageClick)
addListenersOnMenuButtons();

