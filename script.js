// 模組導入
const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint, Events, Body } = Matter;

// 建立引擎與場景
const engine = Engine.create();
const world = engine.world;

// 取得容器寬高
const container = document.getElementById('canvas-container');
const width = window.innerWidth;
const height = window.innerHeight;

// 建立渲染器
const render = Render.create({
    element: container,
    engine: engine,
    options: {
        width: width,
        height: height,
        background: '#f8f9fa',
        wireframes: false // 關閉線框模式，顯示色彩
    }
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

// 建立邊界（地面、左牆、右牆）
const ground = Bodies.rectangle(width / 2, height + 30, width, 60, { isStatic: true, render: { fillStyle: '#d3d3d3' } });
const leftWall = Bodies.rectangle(-30, height / 2, 60, height, { isStatic: true });
const rightWall = Bodies.rectangle(width + 30, height / 2, 60, height, { isStatic: true });
Composite.add(world, [ground, leftWall, rightWall]);

// 建立安全陣列來追蹤動態產生的 DOM 道具與物理個體
let spawnItems = [];

// 當前老鼠的面向狀態 (false = 朝左, true = 朝右)
let isFacingRight = false;

// 當前形象索引 (0 = 原本 CSS, 1 = 寫實照片)
let currentSkin = 0;

// 靜音狀態控制開關
let isMuted = false;

// 建立主角：預設倉鼠
const hamster = Bodies.rectangle(width / 2, height - 100, 80, 60, {
    chamfer: { radius: 25 }, // 讓外觀圓潤一點
    restitution: 0.4,       // 彈性
    friction: 0.1,          // 摩擦力
render: {
    visible: false          // 👈 方案 B：將預設的幾何形狀隱形，改用 CSS 代替
}
});
Composite.add(world, hamster);

// 加上滑鼠互動功能（可以抓取物件）
const mouse = Mouse.create(render.canvas);
const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
        stiffness: 0.2,
        render: { visible: false }
    }
});
Composite.add(world, mouseConstraint);
render.mouse = mouse;

// ==================== 自備音效加載系統 ====================
const sndSqueak = new Audio('squeak.mp3');
const sndCrunch = new Audio('crunch.mp3');

function playSqueakSound() {
    if (isMuted) return; 
    sndSqueak.currentTime = 0; 
    sndSqueak.play().catch(e => console.log("音效尚未就緒或被瀏覽器阻擋"));
}

function playCrunchSound() {
    if (isMuted) return; 
    sndCrunch.currentTime = 0;
    sndCrunch.play().catch(e => console.log("音效尚未就緒或被瀏覽器阻擋"));
}

// ==================== 優化：絲滑自主漫步 AI 系統 ====================
let aiTargetVelocityX = 0; 
let aiTimer = 0;           

Events.on(engine, 'beforeUpdate', () => {
    if (mouseConstraint.constraint.body !== hamster) {
        aiTimer--;

        if (aiTimer <= 0) {
            const behavior = Math.floor(Math.random() * 4);
            aiTimer = Math.floor(Math.random() * 80) + 80;

            if (behavior === 0) {
                aiTargetVelocityX = -3.2; 
                isFacingRight = false;
                playSqueakSound();
            } else if (behavior === 1) {
                aiTargetVelocityX = 3.2;  
                isFacingRight = true;
                playSqueakSound();
            } else if (behavior === 2) {
                aiTargetVelocityX = (Math.random() - 0.5) * 1.5; 
                Body.setVelocity(hamster, { x: hamster.velocity.x, y: -5.5 });
                playSqueakSound();
            } else {
                aiTargetVelocityX = 0;    
            }
        }

        const currentVel = hamster.velocity;
        const smoothVelX = currentVel.x + (aiTargetVelocityX - currentVel.x) * 0.08; 
        Body.setVelocity(hamster, { x: smoothVelX, y: currentVel.y });
    } else {
        aiTimer = 0;
        aiTargetVelocityX = 0;
    }
});

// 同步位置與吃飯偵測邏輯
const divHamster = document.getElementById('css-hamster');
const renderTarget = document.getElementById('hamster-render-target');

Events.on(engine, 'afterUpdate', () => {
    const hPos = hamster.position;
    const hAngle = hamster.angle;
    divHamster.style.left = `${hPos.x - 40}px`; 
    divHamster.style.top = `${hPos.y - 30}px`;  
    
    if (isFacingRight) {
        divHamster.style.transform = `rotate(${hAngle}rad) scaleX(-1)`;
    } else {
        divHamster.style.transform = `rotate(${hAngle}rad) scaleX(1)`;
    }

    for (let i = spawnItems.length - 1; i >= 0; i--) {
        const item = spawnItems[i];
        if (item.dom) { 
            const pos = item.body.position;
            const angle = item.body.angle;
            
            item.dom.style.left = `${pos.x - item.width / 2}px`;
            item.dom.style.top = `${pos.y - item.height / 2}px`;
            item.dom.style.transform = `rotate(${angle}rad)`;

            const distance = Math.hypot(pos.x - hPos.x, pos.y - hPos.y);
            
            if (distance < 60) {
                playCrunchSound();         
                Composite.remove(world, item.body); 
                item.dom.remove();         
                spawnItems.splice(i, 1);   
            }
        }
    }
});

// ==================== 閉嘴（靜音）按鈕功能 ====================
const muteBtn = document.getElementById('btn-mute');
if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        if (isMuted) {
            muteBtn.innerText = '🔇 老鼠已安靜';
            muteBtn.style.background = '#9a8c98'; 
            muteBtn.style.boxShadow = '0 4px 0 #4a4e69';
        } else {
            muteBtn.innerText = '🔊 讓老鼠閉嘴';
            muteBtn.style.background = '#e9c46a'; 
            muteBtn.style.boxShadow = '0 4px 0 #dda15e';
            playSqueakSound(); 
        }
    });
}

// ==================== 切換老鼠形象 ====================
document.getElementById('btn-skin').addEventListener('click', () => {
    if (currentSkin === 0) {
        renderTarget.className = 'skin-realistic';
        renderTarget.innerHTML = ''; 
        currentSkin = 1;
    } else {
        renderTarget.className = 'skin-default';
        renderTarget.innerHTML = `
            <div class="ear left"></div>
            <div class="ear right"></div>
            <div class="eye left"></div>
            <div class="eye right"></div>
            <div class="blush left"></div>
            <div class="blush right"></div>
            <div class="nose"></div>
            <div class="tail"></div>
        `;
        currentSkin = 0;
    }
    playSqueakSound(); 
});

// 功能按鈕互動
// 1. 倒木屑
document.getElementById('btn-wood').addEventListener('click', () => {
    for (let i = 0; i < 30; i++) {
        const x = width / 2 + (Math.random() * 200 - 100);
        const y = Math.random() * -100;
        const wood = Bodies.rectangle(x, y, 16, 8, {
            friction: 0.5,
            density: 0.001,
            render: { fillStyle: '#ede0d4' } 
        });
        spawnItems.push({ body: wood, dom: null });
        Composite.add(world, wood);
    }
});

// 2. 餵食葵瓜子
document.getElementById('btn-food').addEventListener('click', () => {
    const x = Math.random() * (width - 100) + 50;
    const seedBody = Bodies.rectangle(x, 0, 24, 36, { 
        restitution: 0.3,
        friction: 0.2,
        render: { visible: false } 
    });

    const seedDiv = document.createElement('div');
    seedDiv.className = 'css-seed';
    document.body.appendChild(seedDiv);

    spawnItems.push({ body: seedBody, dom: seedDiv, width: 24, height: 36 });
    Composite.add(world, seedBody);
});

// 3. 丟入小皮球玩具
document.getElementById('btn-toy').addEventListener('click', () => {
    const x = Math.random() * (width - 100) + 50;
    const toy = Bodies.circle(x, 0, 25, {
        restitution: 0.8, 
        render: { fillStyle: '#e63946' } 
    });
    spawnItems.push({ body: toy, dom: null });
    Composite.add(world, toy);
});

// 4. 全部蛋雕
document.getElementById('btn-clear').addEventListener('click', () => {
    spawnItems.forEach(item => {
        Composite.remove(world, item.body);
        if (item.dom) {
            item.dom.remove();
        }
    });
    spawnItems = []; 
});

// 視窗大小改變時自動調整
window.addEventListener('resize', () => {
    render.canvas.width = window.innerWidth;
    render.canvas.height = window.innerHeight;
    Matter.Body.setPosition(ground, Matter.Vector.create(window.innerWidth / 2, window.innerHeight + 30));
});