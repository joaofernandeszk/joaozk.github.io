(() => {
    "use strict";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const constrainedDevice = connection?.saveData === true
        || (Number.isFinite(navigator.deviceMemory) && navigator.deviceMemory <= 4)
        || (Number.isFinite(navigator.hardwareConcurrency) && navigator.hardwareConcurrency <= 4);
    const foregroundFrameRate = 60;
    const minimumFrameInterval = 1000 / 61;
    const maximumDpr = constrainedDevice ? 1 : coarsePointer ? 1.25 : 1.5;
    const canvas = document.getElementById("orbit-canvas");
    const context = canvas instanceof HTMLCanvasElement ? canvas.getContext("2d", { alpha: true, desynchronized: true }) : null;
    const flightStatus = document.getElementById("flight-status");
    const flightPosition = document.getElementById("flight-position");
    const flightVelocity = document.getElementById("flight-velocity");
    const trafficStatus = document.getElementById("traffic-status");
    const signalBar = document.getElementById("signal-bar");
    const signalValue = document.getElementById("signal-value");
    const pilotBrief = document.getElementById("pilot-brief");
    const dockAlert = document.getElementById("dock-alert");
    const dockName = document.getElementById("dock-name");
    const missionFiles = document.getElementById("mission-files");
    const missionToggle = document.getElementById("mission-toggle");
    const systemToggle = document.getElementById("system-toggle");
    const systemMenu = document.getElementById("system-menu");
    const taskFiles = document.getElementById("task-files");
    const discoveryBar = document.getElementById("discovery-bar");
    const discoveryCount = document.getElementById("discovery-count");
    const soundToggle = document.getElementById("sound-toggle");
    const systemClock = document.getElementById("system-clock");
    const worldSize = document.getElementById("world-size");
    const desktop = document.getElementById("desktop");
    const launchSequence = document.getElementById("launch-sequence");
    const launchStatus = document.getElementById("launch-status");
    const launchCountdown = document.getElementById("launch-countdown");
    const initiateLaunchButton = document.getElementById("initiate-launch");
    const skipLaunchButton = document.getElementById("skip-launch");
    const replayLaunchButton = document.getElementById("replay-launch");
    const spacePlate = document.querySelector(".space-plate");
    const targetButtons = Array.from(document.querySelectorAll("[data-flight-target]"));
    const windows = Array.from(document.querySelectorAll(".os-window"));

    if (!context || !(canvas instanceof HTMLCanvasElement)) return;

    const destinations = [
        { id: "satelyx", label: "SATELYX", file: "PRIMARY_MISSION.TXT", description: "Primary case study: company operations, commercial execution, and internal systems.", x: 0.51, y: 0.43, radius: 52, color: "#9affad", type: "station" },
        { id: "ai", label: "AI LAYER", file: "OPERATING_LAYER.SYS", description: "How AI increases the operating capacity of a small, focused team.", x: 0.79, y: 0.22, radius: 35, color: "#76d9e9", type: "relay" },
        { id: "obra", label: "OBRAXRAY", file: "FOUNDER_OUTPOST.EXE", description: "Secondary founder case study: an automated product designed to run with low daily load.", x: 0.22, y: 0.68, radius: 41, color: "#ffc06b", type: "outpost" },
        { id: "archive", label: "ARCHIVE", file: "PREVIOUS_MISSIONS.DIR", description: "Earlier infrastructure and ecosystem work, translated into capabilities carried forward.", x: 0.77, y: 0.71, radius: 32, color: "#87948a", type: "archive" },
        { id: "comms", label: "COMMS", file: "OPEN_CHANNEL.COM", description: "Professional channels for company building, space, products, and operating systems.", x: 0.48, y: 0.86, radius: 28, color: "#b7ffd0", type: "comms" }
    ];

    const assetSources = {
        satelyx: "assets/os/satelyx-station.svg",
        ai: "assets/os/ai-relay.svg",
        obra: "assets/os/obra-outpost.svg",
        archive: "assets/os/archive-vault.svg",
        comms: "assets/os/comms-array.svg",
        ship: "assets/os/operator-ship-v2.svg"
    };
    const sprites = Object.fromEntries(Object.entries(assetSources).map(([key, source]) => {
        const image = new Image();
        image.decoding = "async";
        image.src = source;
        return [key, image];
    }));

    const debris = Array.from({ length: constrainedDevice ? 8 : 12 }, (_, index) => ({
        id: `DB-${String(index + 1).padStart(2, "0")}`,
        kind: "orbital debris",
        x: 0.12 + ((index * 0.191) % 0.78),
        y: 0.16 + ((index * 0.277) % 0.68),
        radius: 7 + (index % 5) * 2.4,
        rotation: index * 0.81,
        turn: (index % 2 ? -1 : 1) * (0.00006 + (index % 3) * 0.000025),
        contacting: false
    }));

    const satelliteBlueprints = [
        { u: .12, v: .38, vx: 72, vy: 20, radius: 39, spin: .42, color: "#76d9e9" },
        { u: .68, v: .12, vx: -56, vy: 34, radius: 37, spin: -.34, color: "#9affad" },
        { u: .86, v: .57, vx: -74, vy: -18, radius: 40, spin: .28, color: "#b7d8d1" },
        { u: .34, v: .84, vx: 62, vy: -30, radius: 38, spin: -.38, color: "#76d9e9" }
    ];
    const satellites = satelliteBlueprints.slice(0, constrainedDevice ? 2 : coarsePointer ? 3 : 4).map((item, index) => ({
        ...item,
        id: `SAT-${String(index + 1).padStart(2, "0")}`,
        kind: "satellite",
        x: null,
        y: null,
        rotation: index * 1.3,
        contacting: false
    }));

    const fastDebrisBlueprints = [
        { u: .08, v: .2, vx: 330, vy: 92, radius: 9 },
        { u: .92, v: .35, vx: -370, vy: -54, radius: 11 },
        { u: .42, v: .08, vx: 112, vy: 310, radius: 8 },
        { u: .25, v: .9, vx: 286, vy: -206, radius: 10 },
        { u: .78, v: .82, vx: -246, vy: -268, radius: 10 }
    ];
    const fastDebris = fastDebrisBlueprints.slice(0, constrainedDevice ? 2 : coarsePointer ? 3 : 5).map((item, index) => ({
        ...item,
        id: `HV-${String(index + 1).padStart(2, "0")}`,
        kind: "high-velocity debris",
        x: null,
        y: null,
        rotation: index * .9,
        contacting: false
    }));

    const alienBlueprints = [
        { u: .18, v: .18, vx: 17, vy: 5, size: 78, depth: .38, phase: .4 },
        { u: .72, v: .38, vx: -13, vy: 8, size: 64, depth: .52, phase: 2.1 },
        { u: .48, v: .72, vx: 20, vy: -4, size: 92, depth: .28, phase: 4.2 }
    ];
    const alienTraffic = alienBlueprints.slice(0, constrainedDevice ? 1 : coarsePointer ? 2 : 3).map((item) => ({ ...item, x: null, y: null }));

    const stars = Array.from({ length: constrainedDevice ? 48 : coarsePointer ? 64 : 90 }, () => ({
        x: Math.random(),
        y: Math.random(),
        alpha: 0.16 + Math.random() * 0.62,
        size: Math.random() < 0.72 ? 1.4 : 2.2 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
        depth: 0.2 + Math.random() * 1.2
    }));

    const ship = { x: 0, y: 0, vx: 0, vy: 0, angle: 0 };
    const world = { width: 1, height: 1 };
    const camera = { x: 0, y: 0 };
    const engineTrail = [];
    const meteorShower = {
        active: false,
        countdown: 25 + Math.random() * 35,
        remaining: 0,
        seen: 0,
        meteors: []
    };
    const keys = new Set();
    const visited = loadVisited();
    let width = 0;
    let height = 0;
    let dpr = 1;
    let selectedTarget = null;
    let manualTarget = null;
    let docking = false;
    let animationId = 0;
    let frameScheduled = false;
    let lastTime = performance.now();
    let soundEnabled = false;
    let audioContext = null;
    let masterGain = null;
    let engineOscillator = null;
    let engineGain = null;
    let engineSubOscillator = null;
    let engineSubGain = null;
    let engineNoiseSource = null;
    let engineNoiseGain = null;
    let pilotBriefTimer = 0;
    let launchRunning = false;
    const launchTimers = [];
    let zIndex = 10;
    let activeWindow = null;
    let lastDocked = null;
    let hoveredTarget = null;
    let trafficCollisions = 0;
    const renderStats = { state: "starting", targetFps: foregroundFrameRate, dpr: 1 };

    if (desktop instanceof HTMLElement) desktop.inert = true;

    function loadVisited() {
        try {
            const stored = JSON.parse(window.localStorage.getItem("joao-os-discovered") || "[]");
            return new Set(Array.isArray(stored) ? stored : []);
        } catch (_error) {
            return new Set();
        }
    }

    function saveVisited() {
        try {
            window.localStorage.setItem("joao-os-discovered", JSON.stringify(Array.from(visited)));
        } catch (_error) {
            // Discovery still works for the current session.
        }
    }

    function runBoot() {
        const boot = document.getElementById("boot-screen");
        if (!boot) return;

        let booted = false;
        try {
            booted = window.sessionStorage.getItem("joao-os-booted") === "1";
            window.sessionStorage.setItem("joao-os-booted", "1");
        } catch (_error) {
            booted = false;
        }

        const delay = reducedMotion || booted ? 20 : 680;
        window.setTimeout(() => boot.classList.add("finished"), delay);
        window.setTimeout(() => initiateLaunchButton?.focus(), delay + 520);
    }

    function queueLaunchStep(callback, delay) {
        const timer = window.setTimeout(callback, delay);
        launchTimers.push(timer);
    }

    function clearLaunchTimers() {
        launchTimers.splice(0).forEach((timer) => window.clearTimeout(timer));
    }

    function setLaunchMessage(message, countdown) {
        if (launchStatus) launchStatus.textContent = message;
        if (launchCountdown && countdown) launchCountdown.textContent = countdown;
    }

    function completeLaunch(instant = false) {
        clearLaunchTimers();
        launchRunning = false;
        launchSequence?.classList.toggle("skip-transition", instant);
        launchSequence?.classList.add("complete");
        document.body.classList.remove("prelaunch");
        document.body.classList.add("operations-online");
        if (desktop instanceof HTMLElement) desktop.inert = false;
        ship.x = world.width * (window.innerWidth <= 780 ? 0.32 : 0.36);
        ship.y = world.height * (window.innerWidth <= 780 ? 0.28 : 0.3);
        ship.vx = window.innerWidth <= 780 ? 45 : 80;
        ship.vy = 12;
        centerCamera(true);
        setStatus("ORBITAL HOLD");
        setPilotBrief("FLIGHT SYSTEM ONLINE", "FREE NAVIGATION", "Select a destination or take manual control with WASD / ARROWS.");
        wakeRenderer();
        canvas.focus();
    }

    function beginLaunch(withSound = true) {
        if (!launchSequence || launchRunning) return;
        launchRunning = true;
        soundEnabled = withSound;
        updateSoundButton();
        if (withSound) playLaunchSound();

        launchSequence.classList.remove("complete", "launching", "doors-open");
        launchSequence.classList.add("arming");
        setLaunchMessage("POWERING FLIGHT SYSTEMS", "T− 03");

        if (reducedMotion) {
            queueLaunchStep(completeLaunch, 180);
            return;
        }

        queueLaunchStep(() => setLaunchMessage("RELEASING DOCK CLAMPS", "T− 03"), 620);
        queueLaunchStep(() => launchSequence.classList.add("doors-open"), 950);
        queueLaunchStep(() => setLaunchMessage("MAIN PROPULSION NOMINAL", "T− 02"), 1450);
        queueLaunchStep(() => setLaunchMessage("ORBITAL VECTOR LOCKED", "T− 01"), 2150);
        queueLaunchStep(() => {
            setLaunchMessage("IGNITION", "T+ 00");
            launchSequence.classList.add("launching");
        }, 2650);
        queueLaunchStep(completeLaunch, 5250);
    }

    function replayLaunch() {
        clearLaunchTimers();
        launchRunning = false;
        launchSequence?.classList.remove("complete", "arming", "launching", "doors-open", "skip-transition");
        document.body.classList.remove("operations-online");
        document.body.classList.add("prelaunch");
        if (desktop instanceof HTMLElement) desktop.inert = true;
        setLaunchMessage("AWAITING OPERATOR", "T− READY");
        window.setTimeout(() => initiateLaunchButton?.focus(), 80);
    }

    function updateClock() {
        const now = new Date();
        const full = now.toLocaleTimeString("en-GB", { hour12: false });
        if (systemClock) systemClock.textContent = full;
    }

    function ensureAudio() {
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                masterGain = audioContext.createGain();
                masterGain.gain.value = 0.72;
                masterGain.connect(audioContext.destination);
            }
            if (audioContext.state === "suspended") audioContext.resume();
            return true;
        } catch (_error) {
            soundEnabled = false;
            updateSoundButton();
            return false;
        }
    }

    function scheduleTone(frequency, duration, volume, type = "sine", delay = 0, endFrequency = frequency) {
        if (!soundEnabled || !ensureAudio() || !audioContext || !masterGain) return;
        const start = audioContext.currentTime + delay;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + Math.min(.12, duration * .2));
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator.connect(gain);
        gain.connect(masterGain);
        oscillator.start(start);
        oscillator.stop(start + duration + .03);
    }

    function playLaunchSound() {
        if (!soundEnabled || !ensureAudio() || !audioContext || !masterGain) return;
        const now = audioContext.currentTime;
        scheduleTone(34, 4.9, .18, "sine", 0, 92);
        scheduleTone(58, 4.6, .055, "sawtooth", .2, 138);
        scheduleTone(110, 2.2, .018, "triangle", 2.35, 360);
        scheduleTone(640, .08, .022, "sine", .7, 880);
        scheduleTone(720, .08, .022, "sine", 1.45, 980);
        scheduleTone(880, .12, .028, "sine", 2.15, 1320);

        const sampleCount = Math.ceil(audioContext.sampleRate * 4.8);
        const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let index = 0; index < sampleCount; index += 1) data[index] = Math.random() * 2 - 1;
        const noise = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        noise.buffer = buffer;
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(160, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 3.4);
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(.07, now + 2.8);
        gain.gain.exponentialRampToValueAtTime(.0001, now + 4.8);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(now);
        noise.stop(now + 4.85);
    }

    function ensureEngineBed() {
        if (!soundEnabled || !ensureAudio() || !audioContext || !masterGain || engineOscillator) return;
        engineOscillator = audioContext.createOscillator();
        engineGain = audioContext.createGain();
        engineSubOscillator = audioContext.createOscillator();
        engineSubGain = audioContext.createGain();
        engineNoiseGain = audioContext.createGain();
        const mainFilter = audioContext.createBiquadFilter();
        const noiseFilter = audioContext.createBiquadFilter();
        engineOscillator.type = "sine";
        engineOscillator.frequency.value = 72;
        engineSubOscillator.type = "sine";
        engineSubOscillator.frequency.value = 34;
        mainFilter.type = "lowpass";
        mainFilter.frequency.value = 420;
        engineGain.gain.value = .0001;
        engineSubGain.gain.value = .0001;
        engineNoiseGain.gain.value = .0001;
        engineOscillator.connect(mainFilter);
        mainFilter.connect(engineGain);
        engineGain.connect(masterGain);
        engineSubOscillator.connect(engineSubGain);
        engineSubGain.connect(masterGain);

        const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate, audioContext.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let index = 0; index < noiseData.length; index += 1) noiseData[index] = Math.random() * 2 - 1;
        engineNoiseSource = audioContext.createBufferSource();
        engineNoiseSource.buffer = noiseBuffer;
        engineNoiseSource.loop = true;
        noiseFilter.type = "lowpass";
        noiseFilter.frequency.value = 360;
        noiseFilter.Q.value = .4;
        engineNoiseSource.connect(noiseFilter);
        noiseFilter.connect(engineNoiseGain);
        engineNoiseGain.connect(masterGain);
        engineOscillator.start();
        engineSubOscillator.start();
        engineNoiseSource.start();
    }

    function updateEngineSound(speed, thrusting) {
        if (!soundEnabled || document.hidden) return;
        ensureEngineBed();
        if (!audioContext || !engineOscillator || !engineGain || !engineSubOscillator || !engineSubGain || !engineNoiseGain) return;
        const now = audioContext.currentTime;
        const intensity = Math.min(1, speed / 440);
        const audible = thrusting || speed > 18;
        engineOscillator.frequency.setTargetAtTime(72 + intensity * 150, now, .08);
        engineSubOscillator.frequency.setTargetAtTime(34 + intensity * 48, now, .1);
        engineGain.gain.setTargetAtTime(audible ? .024 + intensity * .056 : .0001, now, .1);
        engineSubGain.gain.setTargetAtTime(audible ? .018 + intensity * .026 : .0001, now, .12);
        engineNoiseGain.gain.setTargetAtTime(audible ? .011 + intensity * .03 : .0001, now, .12);
    }

    function fadeEngine() {
        if (!audioContext || !engineGain) return;
        engineGain.gain.setTargetAtTime(.0001, audioContext.currentTime, .06);
        engineSubGain?.gain.setTargetAtTime(.0001, audioContext.currentTime, .06);
        engineNoiseGain?.gain.setTargetAtTime(.0001, audioContext.currentTime, .06);
    }

    function beep(frequency = 560, duration = 0.055, volume = 0.025) {
        scheduleTone(frequency, duration, volume, "sine", 0, frequency * 1.08);
    }

    function updateSoundButton() {
        if (!soundToggle) return;
        soundToggle.textContent = soundEnabled ? "SOUND ON" : "SOUND OFF";
        soundToggle.setAttribute("aria-pressed", String(soundEnabled));
        if (!soundEnabled) fadeEngine();
    }

    function destinationPoint(destination) {
        return { x: destination.x * world.width, y: destination.y * world.height };
    }

    function worldToScreen(point) {
        return { x: point.x - camera.x, y: point.y - camera.y };
    }

    function screenToWorld(x, y) {
        return { x: x + camera.x, y: y + camera.y };
    }

    function clamp(value, minimum, maximum) {
        return Math.min(maximum, Math.max(minimum, value));
    }

    function centerCamera(snap = false, delta = .016) {
        const targetX = clamp(ship.x - width * .5, 0, Math.max(0, world.width - width));
        const targetY = clamp(ship.y - height * .5, 0, Math.max(0, world.height - height));
        if (snap) {
            camera.x = targetX;
            camera.y = targetY;
        } else {
            const follow = Math.min(1, delta * 3.4);
            camera.x += (targetX - camera.x) * follow;
            camera.y += (targetY - camera.y) * follow;
        }
        canvas.dataset.cameraX = String(Math.round(camera.x));
        canvas.dataset.cameraY = String(Math.round(camera.y));
    }

    function resizeCanvas() {
        const oldWorldWidth = world.width;
        const oldWorldHeight = world.height;
        const bounds = canvas.getBoundingClientRect();
        width = Math.max(1, bounds.width);
        height = Math.max(1, bounds.height);
        world.width = Math.max(1500, width + 1050);
        world.height = Math.max(1300, height + 700);
        dpr = Math.min(window.devicePixelRatio || 1, maximumDpr);
        renderStats.dpr = Number(dpr.toFixed(2));
        canvas.dataset.renderDpr = String(renderStats.dpr);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        context.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (ship.x === 0 && ship.y === 0 || oldWorldWidth <= 1 || oldWorldHeight <= 1) {
            ship.x = world.width * (window.innerWidth <= 780 ? .32 : .36);
            ship.y = world.height * (window.innerWidth <= 780 ? .28 : .3);
        } else {
            ship.x = clamp(ship.x * (world.width / oldWorldWidth), 24, world.width - 24);
            ship.y = clamp(ship.y * (world.height / oldWorldHeight), 24, world.height - 24);
        }

        [...satellites, ...fastDebris, ...alienTraffic].forEach((entity) => {
            if (!Number.isFinite(entity.x) || !Number.isFinite(entity.y) || oldWorldWidth <= 1 || oldWorldHeight <= 1) {
                entity.x = entity.u * world.width;
                entity.y = entity.v * world.height;
            } else {
                entity.x = clamp(entity.x * (world.width / oldWorldWidth), -50, world.width + 50);
                entity.y = clamp(entity.y * (world.height / oldWorldHeight), -50, world.height + 50);
            }
        });
        canvas.dataset.worldWidth = String(Math.round(world.width));
        canvas.dataset.worldHeight = String(Math.round(world.height));
        canvas.dataset.satelliteCount = String(satellites.length);
        canvas.dataset.fastDebrisCount = String(fastDebris.length);
        canvas.dataset.alienTrafficCount = String(alienTraffic.length);
        canvas.dataset.physicalTrafficCount = String(satellites.length + fastDebris.length + debris.length);
        canvas.dataset.trafficCollisions = String(trafficCollisions);
        canvas.dataset.meteorShower = meteorShower.active ? "active" : "idle";
        canvas.dataset.meteorShowersSeen = String(meteorShower.seen);
        if (trafficStatus) trafficStatus.textContent = `${String(satellites.length + fastDebris.length + debris.length).padStart(2, "0")} PHYSICAL / ${String(alienTraffic.length).padStart(2, "0")} UNKNOWN`;
        if (worldSize) worldSize.textContent = `${Math.round(world.width)} × ${Math.round(world.height)}`;
        centerCamera(true);
    }

    function setStatus(message) {
        if (flightStatus) flightStatus.textContent = message;
    }

    function hidePilotBrief() {
        window.clearTimeout(pilotBriefTimer);
        pilotBrief?.classList.remove("visible");
    }

    function setPilotBrief(kicker, title, description, duration = 2600) {
        if (!pilotBrief) return;
        window.clearTimeout(pilotBriefTimer);
        const label = pilotBrief.querySelector("span");
        const heading = pilotBrief.querySelector("strong");
        const copy = pilotBrief.querySelector("p");
        if (label) label.textContent = kicker;
        if (heading) heading.textContent = title;
        if (copy) copy.textContent = description;
        pilotBrief.classList.add("visible");
        if (duration > 0) pilotBriefTimer = window.setTimeout(hidePilotBrief, duration);
    }

    function updateDiscovery() {
        const count = visited.size;
        if (discoveryBar) discoveryBar.style.width = `${(count / destinations.length) * 100}%`;
        if (discoveryCount) discoveryCount.textContent = `${count} / ${destinations.length}`;
        targetButtons.forEach((button) => {
            button.classList.toggle("discovered", visited.has(button.dataset.flightTarget));
        });
    }

    function setMissionDirectory(open) {
        if (!missionFiles || !missionToggle) return;
        if (window.innerWidth <= 780) {
            missionFiles.classList.remove("collapsed");
            missionFiles.classList.toggle("open", open);
        } else {
            missionFiles.classList.remove("open");
            missionFiles.classList.toggle("collapsed", !open);
        }
        missionToggle.setAttribute("aria-expanded", String(open));
    }

    function closeSystemMenu() {
        if (!systemMenu || !systemToggle) return;
        systemMenu.hidden = true;
        systemToggle.setAttribute("aria-expanded", "false");
    }

    function closeNavigationMenus() {
        setMissionDirectory(false);
        closeSystemMenu();
    }

    function selectDestination(destination) {
        if (docking) return;
        const mountedWindow = windows.find((item) => item.dataset.window === destination.id && !item.hidden);
        if (mountedWindow) {
            mountedWindow.classList.remove("minimized");
            mountedWindow.removeAttribute("aria-hidden");
            bringToFront(mountedWindow);
            closeNavigationMenus();
            return;
        }
        if (lastDocked === destination.id) lastDocked = null;
        selectedTarget = destination;
        manualTarget = destinationPoint(destination);
        targetButtons.forEach((button) => {
            button.classList.toggle("active", button.dataset.flightTarget === destination.id);
        });
        setStatus(`AUTOPILOT / ${destination.label}`);
        setPilotBrief("AUTOPILOT ENGAGED", destination.label, `Vector locked. Dock to mount ${destination.file}.`);
        closeNavigationMenus();
        beep(640, 0.045, 0.024);
        wakeRenderer();

        if (reducedMotion) {
            window.setTimeout(() => beginDocking(destination), 80);
        }
    }

    function nearestDestination(x, y, extraRadius = 20) {
        return destinations.find((destination) => {
            const point = destinationPoint(destination);
            return Math.hypot(x - point.x, y - point.y) <= destination.radius + extraRadius;
        });
    }

    function beginDocking(destination) {
        if (docking || lastDocked === destination.id) return;
        docking = true;
        lastDocked = destination.id;
        selectedTarget = destination;
        manualTarget = null;
        ship.vx = 0;
        ship.vy = 0;
        visited.add(destination.id);
        saveVisited();
        updateDiscovery();
        setStatus("DOCKING COMPLETE");
        setPilotBrief("LINK ESTABLISHED", destination.label, `Mounting ${destination.file}.`);
        if (dockName) dockName.textContent = destination.label;
        if (dockAlert) dockAlert.hidden = false;
        beep(760, 0.075, 0.035);
        wakeRenderer();
        window.setTimeout(() => beep(980, 0.09, 0.03), 90);

        window.setTimeout(() => {
            if (dockAlert) dockAlert.hidden = true;
            targetButtons.forEach((button) => button.classList.remove("active"));
            docking = false;
            selectedTarget = null;
            setStatus("ORBITAL HOLD");
            setPilotBrief("FILE MOUNTED", destination.file, "Close or minimize the file to return to orbital navigation.");
            openWindow(destination.id);
        }, reducedMotion ? 180 : 760);
    }

    function deflectTrafficFromDestinations(entity, padding = 30) {
        for (const destination of destinations) {
            const station = destinationPoint(destination);
            const dx = entity.x - station.x;
            const dy = entity.y - station.y;
            const distance = Math.max(.01, Math.hypot(dx, dy));
            const minimumDistance = destination.radius + entity.radius + padding;
            if (distance >= minimumDistance) continue;
            const nx = dx / distance;
            const ny = dy / distance;
            entity.x = station.x + nx * minimumDistance;
            entity.y = station.y + ny * minimumDistance;
            const approach = entity.vx * nx + entity.vy * ny;
            if (approach < 0) {
                entity.vx -= 1.85 * approach * nx;
                entity.vy -= 1.85 * approach * ny;
            }
        }
    }

    function resolveShipTrafficCollision(entity, point = entity, movable = true, controlMode = "coast") {
        if (activeWindow || docking) {
            entity.contacting = false;
            return false;
        }

        const entityVx = movable && Number.isFinite(entity.vx) ? entity.vx : 0;
        const entityVy = movable && Number.isFinite(entity.vy) ? entity.vy : 0;
        let dx = ship.x - point.x;
        let dy = ship.y - point.y;
        let distance = Math.hypot(dx, dy);
        const shipCollisionRadius = 26;
        const minimumDistance = entity.radius + shipCollisionRadius;
        if (distance >= minimumDistance) {
            entity.contacting = false;
            return false;
        }

        let nx;
        let ny;
        if (distance > .5) {
            nx = dx / distance;
            ny = dy / distance;
        } else {
            const relativeSpeed = Math.hypot(ship.vx - entityVx, ship.vy - entityVy);
            nx = relativeSpeed > .5 ? -(ship.vx - entityVx) / relativeSpeed : Math.cos(entity.rotation || 0);
            ny = relativeSpeed > .5 ? -(ship.vy - entityVy) / relativeSpeed : Math.sin(entity.rotation || 0);
            distance = .5;
            dx = nx * distance;
            dy = ny * distance;
        }

        const wasContacting = entity.contacting;
        entity.contacting = true;
        ship.x = point.x + nx * (minimumDistance + .75);
        ship.y = point.y + ny * (minimumDistance + .75);

        const relativeVx = ship.vx - entityVx;
        const relativeVy = ship.vy - entityVy;
        const normalSpeed = relativeVx * nx + relativeVy * ny;
        if (normalSpeed < 0) {
            const restitution = entity.kind === "high-velocity debris" ? .52 : .34;
            const normalImpulse = -(1 + restitution) * normalSpeed;
            ship.vx += nx * normalImpulse;
            ship.vy += ny * normalImpulse;

            const tx = -ny;
            const ty = nx;
            const tangentSpeed = relativeVx * tx + relativeVy * ty;
            ship.vx -= tx * tangentSpeed * .16;
            ship.vy -= ty * tangentSpeed * .16;

            if (movable) {
                entity.vx -= nx * normalImpulse * .12;
                entity.vy -= ny * normalImpulse * .12;
            }

            if (controlMode === "autopilot") {
                const side = entity.id.charCodeAt(entity.id.length - 1) % 2 === 0 ? 1 : -1;
                const avoidance = Math.min(110, Math.max(54, Math.abs(normalSpeed) * .32));
                ship.vx += tx * side * avoidance;
                ship.vy += ty * side * avoidance;
            }
        }

        if (!wasContacting) {
            trafficCollisions += 1;
            canvas.dataset.trafficCollisions = String(trafficCollisions);
            canvas.dataset.lastCollisionMode = controlMode;
            canvas.dataset.lastCollisionObject = entity.id;
            const contactName = entity.kind === "satellite"
                ? entity.id
                : entity.kind === "orbital debris"
                    ? `DEBRIS ${entity.id}`
                    : "HIGH-VELOCITY OBJECT";

            if (controlMode === "autopilot") {
                setStatus("COLLISION AVOIDANCE");
                setPilotBrief("PROXIMITY ALERT", contactName, "Impact absorbed. Autopilot is correcting the course.", 1700);
            } else if (controlMode === "manual") {
                setStatus("MANUAL CONTACT");
                hidePilotBrief();
            }
            beep(entity.kind === "satellite" ? 190 : 125, .075, .035);
        }
        return true;
    }

    function updateWorldTraffic(delta) {
        for (const satellite of satellites) {
            satellite.rotation += satellite.spin * delta;
            satellite.x += satellite.vx * delta;
            satellite.y += satellite.vy * delta;
            if (satellite.x < satellite.radius || satellite.x > world.width - satellite.radius) {
                satellite.vx *= -1;
                satellite.x = clamp(satellite.x, satellite.radius, world.width - satellite.radius);
            }
            if (satellite.y < satellite.radius || satellite.y > world.height - satellite.radius) {
                satellite.vy *= -1;
                satellite.y = clamp(satellite.y, satellite.radius, world.height - satellite.radius);
            }
            deflectTrafficFromDestinations(satellite, 34);
        }

        for (const item of fastDebris) {
            item.rotation += delta * (item.vx < 0 ? -2.8 : 2.8);
            item.x += item.vx * delta;
            item.y += item.vy * delta;
            const edge = 50;
            if (item.x < -edge) item.x = world.width + edge;
            if (item.x > world.width + edge) item.x = -edge;
            if (item.y < -edge) item.y = world.height + edge;
            if (item.y > world.height + edge) item.y = -edge;
            deflectTrafficFromDestinations(item, 82);
        }

        for (const craft of alienTraffic) {
            craft.x += craft.vx * delta;
            craft.y += craft.vy * delta;
            const edge = 90;
            if (craft.x < -edge) craft.x = world.width + edge;
            if (craft.x > world.width + edge) craft.x = -edge;
            if (craft.y < -edge) craft.y = world.height + edge;
            if (craft.y > world.height + edge) craft.y = -edge;
        }
    }

    function beginMeteorShower() {
        const count = constrainedDevice ? 7 : coarsePointer ? 9 : 13;
        meteorShower.active = true;
        meteorShower.remaining = 6.5;
        meteorShower.seen += 1;
        meteorShower.meteors = Array.from({ length: count }, (_, index) => ({
            x: width * (.45 + Math.random() * .95) + index * 22,
            y: -80 - Math.random() * height * .48,
            vx: -(430 + Math.random() * 310),
            vy: 310 + Math.random() * 240,
            delay: Math.random() * 2.7,
            size: 2.6 + Math.random() * 3.4,
            length: 74 + Math.random() * 92,
            alpha: .48 + Math.random() * .42
        }));
        canvas.dataset.meteorShower = "active";
        canvas.dataset.meteorShowersSeen = String(meteorShower.seen);
    }

    function updateMeteorShower(delta) {
        if (!meteorShower.active) {
            meteorShower.countdown -= delta;
            if (meteorShower.countdown <= 0) beginMeteorShower();
            return;
        }

        meteorShower.remaining -= delta;
        for (const meteor of meteorShower.meteors) {
            if (meteor.delay > 0) {
                meteor.delay -= delta;
                continue;
            }
            meteor.x += meteor.vx * delta;
            meteor.y += meteor.vy * delta;
        }

        if (meteorShower.remaining <= 0) {
            meteorShower.active = false;
            meteorShower.meteors = [];
            meteorShower.countdown = 90 + Math.random() * 100;
            canvas.dataset.meteorShower = "idle";
        }
    }

    function updateFlight(delta) {
        if (reducedMotion) return;
        updateWorldTraffic(delta);
        updateMeteorShower(delta);
        if (docking) return;

        const manual = keys.size > 0;
        let ax = 0;
        let ay = 0;
        const thrust = 520;

        if (keys.has("arrowleft") || keys.has("a")) ax -= thrust;
        if (keys.has("arrowright") || keys.has("d")) ax += thrust;
        if (keys.has("arrowup") || keys.has("w")) ay -= thrust;
        if (keys.has("arrowdown") || keys.has("s")) ay += thrust;

        if (manual) {
            selectedTarget = null;
            manualTarget = null;
            targetButtons.forEach((button) => button.classList.remove("active"));
            ship.vx += ax * delta;
            ship.vy += ay * delta;
        } else if (manualTarget) {
            const dx = manualTarget.x - ship.x;
            const dy = manualTarget.y - ship.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const targetSpeed = Math.min(430, Math.max(80, distance * 2.1));
            const desiredVx = (dx / distance) * targetSpeed;
            const desiredVy = (dy / distance) * targetSpeed;
            const steering = Math.min(1, delta * 4.6);
            ship.vx += (desiredVx - ship.vx) * steering;
            ship.vy += (desiredVy - ship.vy) * steering;
            if (distance < 12 && !selectedTarget) {
                manualTarget = null;
                ship.vx *= .3;
                ship.vy *= .3;
                setStatus("ORBITAL HOLD");
                setPilotBrief("VECTOR COMPLETE", "ORBITAL HOLD", "Select another coordinate or mission file.", 1700);
            }
        }

        const speed = Math.hypot(ship.vx, ship.vy);
        const maxSpeed = 440;
        if (speed > maxSpeed) {
            ship.vx = (ship.vx / speed) * maxSpeed;
            ship.vy = (ship.vy / speed) * maxSpeed;
        }

        if (!manualTarget && !manual) {
            const drag = Math.pow(0.95, delta * 60);
            ship.vx *= drag;
            ship.vy *= drag;
        }

        ship.x += ship.vx * delta;
        ship.y += ship.vy * delta;

        if (speed > 16 && !reducedMotion) {
            engineTrail.push({
                x: ship.x - Math.cos(ship.angle) * 14,
                y: ship.y - Math.sin(ship.angle) * 14,
                life: 1,
                size: 1.5 + Math.random() * 2.5
            });
            if (engineTrail.length > 28) engineTrail.shift();
        }
        engineTrail.forEach((particle) => { particle.life -= delta * 2.1; });
        while (engineTrail[0]?.life <= 0) engineTrail.shift();

        const margin = 14;
        if (ship.x < margin || ship.x > world.width - margin) {
            ship.vx *= -0.5;
            ship.x = Math.min(world.width - margin, Math.max(margin, ship.x));
        }
        if (ship.y < margin || ship.y > world.height - margin) {
            ship.vy *= -0.5;
            ship.y = Math.min(world.height - margin, Math.max(margin, ship.y));
        }

        if (Math.abs(ship.vx) + Math.abs(ship.vy) > 2) {
            ship.angle = Math.atan2(ship.vy, ship.vx);
        }

        const controlMode = manual ? "manual" : manualTarget || selectedTarget ? "autopilot" : "coast";
        satellites.forEach((satellite) => {
            resolveShipTrafficCollision(satellite, satellite, true, controlMode);
        });
        fastDebris.forEach((item) => {
            resolveShipTrafficCollision(item, item, true, controlMode);
        });

        for (const item of debris) {
            item.rotation += item.turn * delta * 1000;
            if (!debrisIsClear(item)) continue;
            const point = debrisPoint(item);
            resolveShipTrafficCollision(item, point, false, controlMode);
        }

        let dockedAt = null;
        if (selectedTarget) {
            const selectedPoint = destinationPoint(selectedTarget);
            if (Math.hypot(ship.x - selectedPoint.x, ship.y - selectedPoint.y) <= selectedTarget.radius + 13) {
                dockedAt = selectedTarget;
            }
        } else {
            dockedAt = nearestDestination(ship.x, ship.y, 13);
        }
        if (dockedAt) beginDocking(dockedAt);
        else lastDocked = null;

        if (flightPosition) {
            flightPosition.textContent = `X ${String(Math.round(ship.x)).padStart(3, "0")} / Y ${String(Math.round(ship.y)).padStart(3, "0")}`;
        }
        if (flightVelocity) flightVelocity.textContent = `${(speed / 100).toFixed(2)} KM/S`;
        const signal = Math.max(68, Math.round(100 - speed * 0.045));
        if (signalBar) signalBar.style.width = `${signal}%`;
        if (signalValue) signalValue.textContent = `${signal}%`;
        updateEngineSound(speed, manual || Boolean(manualTarget));
        centerCamera(false, delta);
        if (spacePlate instanceof HTMLElement) {
            const cameraRangeX = Math.max(1, world.width - width);
            const cameraRangeY = Math.max(1, world.height - height);
            const parallaxX = ((camera.x / cameraRangeX) - .5) * -32;
            const parallaxY = ((camera.y / cameraRangeY) - .5) * -22;
            spacePlate.style.transform = `translate3d(${parallaxX}px, ${parallaxY}px, 0) scale(1.06)`;
        }
    }

    function modulo(value, divisor) {
        return ((value % divisor) + divisor) % divisor;
    }

    function debrisPoint(item) {
        return { x: item.x * world.width, y: item.y * world.height };
    }

    function debrisIsClear(item) {
        const point = debrisPoint(item);
        return destinations.every((destination) => {
            const station = destinationPoint(destination);
            return Math.hypot(point.x - station.x, point.y - station.y) > destination.radius + 78;
        });
    }

    function drawBackground(time) {
        context.clearRect(0, 0, width, height);
        context.fillStyle = "rgba(2, 5, 3, 0.32)";
        context.fillRect(0, 0, width, height);

        for (const star of stars) {
            const twinkle = reducedMotion ? 1 : 0.72 + Math.sin(time * 0.0008 + star.phase) * 0.28;
            const x = modulo(star.x * width - camera.x * star.depth * .12, width);
            const y = modulo(star.y * height - camera.y * star.depth * .08, height);
            context.fillStyle = `rgba(210, 239, 216, ${star.alpha * twinkle})`;
            context.fillRect(x, y, star.size, star.size);
        }

        const worldCenter = worldToScreen({ x: world.width * .5, y: world.height * .5 });
        context.save();
        context.strokeStyle = "rgba(118, 217, 233, 0.07)";
        context.lineWidth = 1;
        context.setLineDash([5, 9]);
        context.beginPath();
        context.ellipse(worldCenter.x, worldCenter.y, world.width * .32, world.height * .24, -.18, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.ellipse(worldCenter.x, worldCenter.y, world.width * .21, world.height * .38, .55, 0, Math.PI * 2);
        context.stroke();
        context.restore();

        context.save();
        context.strokeStyle = "rgba(181, 211, 204, .075)";
        context.lineWidth = 1;
        context.strokeRect(-camera.x + .5, -camera.y + .5, world.width - 1, world.height - 1);
        context.restore();

        context.save();
        context.strokeStyle = "rgba(154, 255, 173, 0.065)";
        context.setLineDash([2, 8]);
        context.beginPath();
        destinations.forEach((destination, index) => {
            const point = worldToScreen(destinationPoint(destination));
            if (index === 0) context.moveTo(point.x, point.y);
            else context.lineTo(point.x, point.y);
        });
        context.closePath();
        context.stroke();
        context.restore();
    }

    function drawRoute(time) {
        if (!selectedTarget || docking) return;
        const targetWorldPoint = destinationPoint(selectedTarget);
        const point = worldToScreen(targetWorldPoint);
        const shipPoint = worldToScreen(ship);
        const distance = Math.hypot(targetWorldPoint.x - ship.x, targetWorldPoint.y - ship.y);
        context.save();
        context.strokeStyle = selectedTarget.color;
        context.globalAlpha = 0.38;
        context.lineWidth = 1;
        context.setLineDash([7, 9]);
        context.lineDashOffset = reducedMotion ? 0 : -time * 0.025;
        context.beginPath();
        context.moveTo(shipPoint.x, shipPoint.y);
        context.lineTo(point.x, point.y);
        context.stroke();
        context.setLineDash([]);

        const midpointX = shipPoint.x + (point.x - shipPoint.x) * .52;
        const midpointY = shipPoint.y + (point.y - shipPoint.y) * .52;
        context.fillStyle = "rgba(3, 8, 4, 0.9)";
        context.fillRect(midpointX - 50, midpointY - 12, 100, 24);
        context.strokeStyle = "rgba(154, 255, 173, 0.28)";
        context.strokeRect(midpointX - 50, midpointY - 12, 100, 24);
        context.fillStyle = selectedTarget.color;
        context.globalAlpha = 0.86;
        context.font = "600 9px 'SFMono-Regular', Consolas, monospace";
        context.textAlign = "center";
        context.fillText(`ETA ${Math.max(1, Math.ceil(distance / 360))} SEC`, midpointX, midpointY + 3.5);
        context.restore();
    }

    function drawDebris() {
        for (const item of debris) {
            if (!debrisIsClear(item)) continue;
            const point = worldToScreen(debrisPoint(item));
            if (point.x < -30 || point.y < -30 || point.x > width + 30 || point.y > height + 30) continue;
            context.save();
            context.translate(point.x, point.y);
            context.rotate(item.rotation);
            context.strokeStyle = "rgba(125, 151, 145, 0.28)";
            context.fillStyle = "rgba(87, 102, 91, 0.12)";
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(-item.radius, -item.radius * 0.2);
            context.lineTo(-item.radius * 0.2, -item.radius);
            context.lineTo(item.radius, -item.radius * 0.35);
            context.lineTo(item.radius * 0.5, item.radius);
            context.lineTo(-item.radius * 0.8, item.radius * 0.45);
            context.closePath();
            context.fill();
            context.stroke();
            context.restore();
        }
    }

    function drawAlienTraffic(time) {
        for (const craft of alienTraffic) {
            const point = {
                x: craft.x - camera.x * craft.depth,
                y: craft.y - camera.y * craft.depth
            };
            const margin = craft.size * 2;
            if (point.x < -margin || point.y < -margin || point.x > width + margin || point.y > height + margin) continue;
            const angle = Math.atan2(craft.vy, craft.vx);
            const shimmer = reducedMotion ? 1 : .78 + Math.sin(time * .0018 + craft.phase) * .22;
            const pulse = reducedMotion ? 0 : Math.sin(time * .003 + craft.phase);
            const size = craft.size;
            context.save();
            context.translate(point.x, point.y);
            context.rotate(angle);
            context.globalAlpha = .46 * shimmer;
            context.shadowColor = "#c884ff";
            context.shadowBlur = 22;
            context.fillStyle = "rgba(74, 24, 103, .3)";
            context.strokeStyle = "rgba(203, 139, 255, .72)";
            context.lineWidth = 1.25;

            // An organic manta-like hull with a split tail reads as unknown
            // technology instead of another human aircraft silhouette.
            context.beginPath();
            context.moveTo(size * .58, 0);
            context.bezierCurveTo(size * .26, -size * .4, -size * .18, -size * .46, -size * .42, -size * .2);
            context.bezierCurveTo(-size * .25, -size * .1, -size * .19, -.5, -size * .11, 0);
            context.bezierCurveTo(-size * .19, .5, -size * .25, size * .1, -size * .42, size * .2);
            context.bezierCurveTo(-size * .18, size * .46, size * .26, size * .4, size * .58, 0);
            context.closePath();
            context.fill();
            context.stroke();

            context.globalAlpha = .72 * shimmer;
            context.fillStyle = "rgba(183, 255, 208, .58)";
            context.strokeStyle = "rgba(183, 255, 208, .85)";
            context.beginPath();
            context.ellipse(size * .11, 0, size * .16, size * (.07 + pulse * .006), 0, 0, Math.PI * 2);
            context.fill();
            context.stroke();

            context.globalAlpha = .42 * shimmer;
            context.strokeStyle = "rgba(118, 217, 233, .72)";
            context.lineWidth = 1.15;
            [-.13, 0, .13].forEach((offset, index) => {
                context.beginPath();
                context.moveTo(-size * .35, size * offset);
                context.bezierCurveTo(
                    -size * .55,
                    size * (offset + (index - 1) * .04),
                    -size * (.72 + index * .05),
                    size * (offset - (index - 1) * .08),
                    -size * (.88 + pulse * .025),
                    size * (offset + (index - 1) * .12)
                );
                context.stroke();
            });

            context.globalAlpha = .22 * shimmer;
            context.setLineDash([2, 6]);
            context.beginPath();
            context.ellipse(0, 0, size * .66, size * .37, 0, -.72, .72);
            context.stroke();
            context.setLineDash([]);

            context.globalAlpha = .9 * shimmer;
            context.fillStyle = "#d8a8ff";
            context.shadowBlur = 9;
            context.beginPath();
            context.arc(size * .12, 0, 2.3 + pulse * .45, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }
    }

    function drawMeteorShower() {
        if (!meteorShower.active) return;
        context.save();
        context.lineCap = "round";
        for (const meteor of meteorShower.meteors) {
            if (meteor.delay > 0) continue;
            if (meteor.x < -meteor.length || meteor.y > height + meteor.length) continue;
            const speed = Math.max(1, Math.hypot(meteor.vx, meteor.vy));
            const nx = meteor.vx / speed;
            const ny = meteor.vy / speed;
            const gradient = context.createLinearGradient(
                meteor.x,
                meteor.y,
                meteor.x - nx * meteor.length,
                meteor.y - ny * meteor.length
            );
            gradient.addColorStop(0, `rgba(236, 255, 241, ${meteor.alpha})`);
            gradient.addColorStop(.18, `rgba(154, 255, 173, ${meteor.alpha * .72})`);
            gradient.addColorStop(1, "rgba(118, 217, 233, 0)");
            context.strokeStyle = gradient;
            context.lineWidth = meteor.size;
            context.shadowColor = "#9affad";
            context.shadowBlur = 10;
            context.beginPath();
            context.moveTo(meteor.x, meteor.y);
            context.lineTo(meteor.x - nx * meteor.length, meteor.y - ny * meteor.length);
            context.stroke();
            context.fillStyle = `rgba(245, 255, 247, ${meteor.alpha})`;
            context.beginPath();
            context.arc(meteor.x, meteor.y, meteor.size * .72, 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    }

    function drawSatellites(time) {
        for (const satellite of satellites) {
            const point = worldToScreen(satellite);
            if (point.x < -70 || point.y < -70 || point.x > width + 70 || point.y > height + 70) continue;
            const flightAngle = Math.atan2(satellite.vy, satellite.vx);
            const beacon = reducedMotion ? .7 : .45 + Math.sin(time * .006 + satellite.rotation) * .35;
            context.save();
            context.translate(point.x, point.y);
            context.rotate(flightAngle);
            context.globalAlpha = .82;
            context.strokeStyle = satellite.color;
            context.fillStyle = "rgba(8, 18, 21, .92)";
            context.lineWidth = 1;
            context.shadowColor = satellite.color;
            context.shadowBlur = 7;

            context.save();
            context.rotate(satellite.rotation);
            context.fillRect(-10, -7, 20, 14);
            context.strokeRect(-10, -7, 20, 14);
            context.fillStyle = "rgba(72, 139, 151, .34)";
            context.fillRect(-39, -10, 24, 20);
            context.fillRect(15, -10, 24, 20);
            context.strokeRect(-39, -10, 24, 20);
            context.strokeRect(15, -10, 24, 20);
            context.globalAlpha = .35;
            context.beginPath();
            context.moveTo(-31, -10);
            context.lineTo(-31, 10);
            context.moveTo(-23, -10);
            context.lineTo(-23, 10);
            context.moveTo(23, -10);
            context.lineTo(23, 10);
            context.moveTo(31, -10);
            context.lineTo(31, 10);
            context.stroke();
            context.restore();

            context.globalAlpha = .2;
            context.setLineDash([2, 5]);
            context.beginPath();
            context.arc(0, 0, satellite.radius + 7, 0, Math.PI * 2);
            context.stroke();
            context.setLineDash([]);
            context.globalAlpha = beacon;
            context.fillStyle = "#b7ffd0";
            context.beginPath();
            context.arc(0, -11, 2, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }
    }

    function drawFastDebris() {
        for (const item of fastDebris) {
            const point = worldToScreen(item);
            if (point.x < -80 || point.y < -80 || point.x > width + 80 || point.y > height + 80) continue;
            const speed = Math.max(1, Math.hypot(item.vx, item.vy));
            const nx = item.vx / speed;
            const ny = item.vy / speed;
            const streak = 38 + speed * .075;
            context.save();
            context.globalAlpha = .66;
            context.strokeStyle = "rgba(255, 192, 107, .76)";
            context.lineWidth = 1.6;
            context.lineCap = "round";
            context.shadowColor = "#ffc06b";
            context.shadowBlur = 9;
            context.beginPath();
            context.moveTo(point.x, point.y);
            context.lineTo(point.x - nx * streak, point.y - ny * streak);
            context.stroke();
            context.translate(point.x, point.y);
            context.rotate(item.rotation);
            context.fillStyle = "rgba(239, 247, 241, .9)";
            context.strokeStyle = "rgba(255, 192, 107, .94)";
            context.lineWidth = 1.25;
            context.beginPath();
            context.moveTo(item.radius, 0);
            context.lineTo(-item.radius * .7, -item.radius * .65);
            context.lineTo(-item.radius * .25, item.radius);
            context.closePath();
            context.fill();
            context.stroke();
            context.restore();
        }
    }

    function drawStation(color) {
        context.strokeStyle = color;
        context.fillStyle = "#071008";
        context.lineWidth = 2;
        context.fillRect(-29, -18, 58, 36);
        context.strokeRect(-29, -18, 58, 36);
        context.fillRect(-9, -34, 18, 68);
        context.strokeRect(-9, -34, 18, 68);
        context.globalAlpha = 0.5;
        context.fillStyle = color;
        context.fillRect(-58, -11, 23, 22);
        context.fillRect(35, -11, 23, 22);
        context.globalAlpha = 1;
        context.fillRect(-4, -4, 8, 8);
    }

    function drawRelay(color, time) {
        context.strokeStyle = color;
        context.fillStyle = "#071012";
        context.lineWidth = 2;
        context.rotate(Math.PI / 4 + (reducedMotion ? 0 : time * 0.00022));
        context.fillRect(-16, -16, 32, 32);
        context.strokeRect(-16, -16, 32, 32);
        context.rotate(-Math.PI / 4 - (reducedMotion ? 0 : time * 0.00022));
        context.beginPath();
        context.arc(0, 0, 26, -0.68, 0.68);
        context.stroke();
        context.beginPath();
        context.arc(0, 0, 35, -0.68, 0.68);
        context.stroke();
    }

    function drawOutpost(color) {
        context.strokeStyle = color;
        context.fillStyle = "#120d07";
        context.lineWidth = 2;
        context.rotate(Math.PI / 4);
        context.fillRect(-24, -24, 48, 48);
        context.strokeRect(-24, -24, 48, 48);
        context.rotate(-Math.PI / 4);
        context.fillStyle = color;
        context.fillRect(-6, -6, 12, 12);
        context.beginPath();
        context.moveTo(-38, 0);
        context.lineTo(38, 0);
        context.moveTo(0, -38);
        context.lineTo(0, 38);
        context.stroke();
    }

    function drawArchive(color) {
        context.strokeStyle = color;
        context.fillStyle = "rgba(135, 148, 138, 0.1)";
        context.lineWidth = 2;
        context.fillRect(-23, -15, 46, 31);
        context.strokeRect(-23, -15, 46, 31);
        context.strokeRect(-23, -22, 19, 7);
        context.beginPath();
        context.moveTo(-15, -4);
        context.lineTo(15, -4);
        context.moveTo(-15, 5);
        context.lineTo(8, 5);
        context.stroke();
    }

    function drawComms(color, time) {
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(0, 20);
        context.lineTo(0, -10);
        context.moveTo(-13, 20);
        context.lineTo(13, 20);
        context.moveTo(-8, -2);
        context.lineTo(0, 6);
        context.lineTo(8, -2);
        context.stroke();
        const pulse = reducedMotion ? 0 : (time * 0.02) % 12;
        context.globalAlpha = 1 - pulse / 16;
        context.beginPath();
        context.arc(0, -10, 10 + pulse, Math.PI * 1.14, Math.PI * 1.86);
        context.stroke();
        context.globalAlpha = 1;
    }

    function drawDestination(destination, time) {
        const point = worldToScreen(destinationPoint(destination));
        if (point.x < -130 || point.y < -130 || point.x > width + 130 || point.y > height + 130) return;
        const selected = selectedTarget?.id === destination.id;
        const discovered = visited.has(destination.id);
        const pulse = reducedMotion ? 0 : Math.sin(time * 0.0025 + destination.x * 9) * 4;

        context.save();
        context.translate(point.x, point.y);

        // Keep each destination visually readable even when traffic and the
        // star field cross behind it. The fade extends beyond the outer ring,
        // so no foreground debris can appear to sit inside the graphic.
        const clearanceRadius = destination.radius + 52;
        const backdrop = context.createRadialGradient(
            0,
            0,
            destination.radius * 0.45,
            0,
            0,
            clearanceRadius
        );
        backdrop.addColorStop(0, "rgba(2, 7, 7, 0.99)");
        backdrop.addColorStop(0.68, "rgba(2, 7, 7, 0.94)");
        backdrop.addColorStop(1, "rgba(2, 7, 7, 0)");
        context.fillStyle = backdrop;
        context.beginPath();
        context.arc(0, 0, clearanceRadius, 0, Math.PI * 2);
        context.fill();

        context.shadowColor = destination.color;
        context.shadowBlur = selected ? 24 : destination.id === "satelyx" ? 11 : 6;
        context.strokeStyle = destination.color;
        context.lineWidth = selected ? 1.5 : 1;
        context.globalAlpha = selected ? 0.58 : 0.2;
        context.beginPath();
        context.arc(0, 0, destination.radius + 18 + pulse, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([3, 6]);
        context.beginPath();
        context.arc(0, 0, destination.radius + 29, 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        context.globalAlpha = 1;

        const sprite = sprites[destination.id];
        if (sprite?.complete && sprite.naturalWidth > 0) {
            const size = destination.radius * (destination.id === "satelyx" ? 2.72 : 2.45);
            const rotation = destination.type === "relay" && !reducedMotion ? time * 0.00008 : 0;
            const scalePulse = destination.type === "comms" && !reducedMotion ? 1 + Math.sin(time * 0.002) * 0.025 : 1;
            context.save();
            context.rotate(rotation);
            context.scale(scalePulse, scalePulse);
            context.drawImage(sprite, -size / 2, -size / 2, size, size);
            context.restore();
        } else {
            if (destination.type === "station") drawStation(destination.color);
            if (destination.type === "relay") drawRelay(destination.color, time);
            if (destination.type === "outpost") drawOutpost(destination.color);
            if (destination.type === "archive") drawArchive(destination.color);
            if (destination.type === "comms") drawComms(destination.color, time);
        }

        context.textAlign = "center";
        context.fillStyle = destination.color;
        context.shadowBlur = 0;
        context.font = "650 13px 'SFMono-Regular', Consolas, monospace";
        context.fillText(destination.label, 0, destination.radius + 49);
        context.fillStyle = "rgba(166, 185, 170, 0.58)";
        context.font = "500 9px 'SFMono-Regular', Consolas, monospace";
        context.fillText(destination.file, 0, destination.radius + 65);
        if (discovered) {
            context.fillStyle = destination.color;
            context.font = "500 9px 'SFMono-Regular', Consolas, monospace";
            context.fillText("DISCOVERED ✓", 0, destination.radius + 80);
        }
        context.restore();
    }

    function drawShip(time) {
        const moving = Math.hypot(ship.vx, ship.vy) > 8;
        const point = worldToScreen(ship);
        context.save();
        context.translate(point.x, point.y);
        context.rotate(ship.angle);
        context.imageSmoothingEnabled = false;
        if (moving && !reducedMotion) {
            const flame = 10 + Math.sin(time * 0.038) * 4;
            context.fillStyle = "#ffc06b";
            context.beginPath();
            context.moveTo(-12, -4);
            context.lineTo(-12 - flame, 0);
            context.lineTo(-12, 4);
            context.fill();
        }
        const sprite = sprites.ship;
        if (sprite?.complete && sprite.naturalWidth > 0) {
            context.drawImage(sprite, -33, -21, 66, 42);
        } else {
            context.fillStyle = "#d9ffe1";
            context.strokeStyle = "#9affad";
            context.lineWidth = 1.5;
            context.beginPath();
            context.moveTo(15, 0);
            context.lineTo(-10, -9);
            context.lineTo(-6, 0);
            context.lineTo(-10, 9);
            context.closePath();
            context.fill();
            context.stroke();
        }
        context.restore();
    }

    function drawEngineTrail() {
        context.save();
        for (const particle of engineTrail) {
            const point = worldToScreen(particle);
            context.globalAlpha = Math.max(0, particle.life) * 0.62;
            context.fillStyle = particle.life > 0.55 ? "#ffc06b" : "#76d9e9";
            context.beginPath();
            context.arc(point.x, point.y, particle.size * particle.life, 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    }

    function drawManualTarget() {
        if (!manualTarget || selectedTarget) return;
        const point = worldToScreen(manualTarget);
        context.save();
        context.translate(point.x, point.y);
        context.strokeStyle = "rgba(154, 255, 173, 0.65)";
        context.lineWidth = 1;
        context.beginPath();
        context.arc(0, 0, 11, 0, Math.PI * 2);
        context.moveTo(-17, 0);
        context.lineTo(17, 0);
        context.moveTo(0, -17);
        context.lineTo(0, 17);
        context.stroke();
        context.restore();
    }

    function draw(time) {
        drawBackground(time);
        drawAlienTraffic(time);
        drawMeteorShower();
        drawDebris();
        drawRoute(time);
        drawFastDebris();
        drawSatellites(time);
        destinations.forEach((destination) => drawDestination(destination, time));
        drawManualTarget();
        drawEngineTrail();
        drawShip(time);
    }

    function updateRenderState(state, targetFps = 0) {
        renderStats.state = state;
        renderStats.targetFps = targetFps;
        if (canvas.dataset.renderState !== state) canvas.dataset.renderState = state;
        const nextFrameRate = String(targetFps);
        if (canvas.dataset.renderFps !== nextFrameRate) canvas.dataset.renderFps = nextFrameRate;
    }

    function pauseRenderer(state = "paused") {
        window.cancelAnimationFrame(animationId);
        animationId = 0;
        frameScheduled = false;
        updateRenderState(state);
    }

    function wakeRenderer() {
        if (document.hidden || frameScheduled) return;
        window.cancelAnimationFrame(animationId);
        frameScheduled = true;
        animationId = window.requestAnimationFrame(gameLoop);
    }

    function gameLoop(time) {
        frameScheduled = false;
        if (document.hidden) {
            pauseRenderer("hidden");
            return;
        }
        if (reducedMotion) {
            draw(time);
            updateRenderState("reduced-motion");
            return;
        }

        const elapsed = time - lastTime;
        if (elapsed < minimumFrameInterval) {
            frameScheduled = true;
            animationId = window.requestAnimationFrame(gameLoop);
            return;
        }

        const delta = Math.min(0.05, Math.max(0, elapsed / 1000));
        lastTime = time;
        updateFlight(delta);
        draw(time);
        updateRenderState("foreground", foregroundFrameRate);
        frameScheduled = true;
        animationId = window.requestAnimationFrame(gameLoop);
    }

    function bringToFront(windowElement) {
        zIndex += 1;
        windows.forEach((item) => item.classList.remove("active"));
        windowElement.classList.add("active");
        windowElement.style.zIndex = String(zIndex);
        activeWindow = windowElement;
        updateTaskButtons();
    }

    function openWindow(id) {
        const windowElement = windows.find((item) => item.dataset.window === id);
        if (!windowElement) return;
        closeNavigationMenus();
        hidePilotBrief();
        windowElement.hidden = false;
        windowElement.classList.remove("minimized");
        windowElement.removeAttribute("aria-hidden");
        ensureTaskButton(id);
        bringToFront(windowElement);
        const close = windowElement.querySelector('[data-window-action="close"]');
        if (close instanceof HTMLElement) close.focus();
    }

    function releaseShipFromDock(id) {
        const destination = destinations.find((item) => item.id === id);
        if (!destination) return;
        const station = destinationPoint(destination);
        const distance = Math.hypot(ship.x - station.x, ship.y - station.y);
        if (distance > destination.radius + 28) return;

        const towardCenterX = world.width * 0.5 - station.x;
        const towardCenterY = world.height * 0.5 - station.y;
        const centerDistance = Math.max(1, Math.hypot(towardCenterX, towardCenterY));
        const nx = towardCenterX / centerDistance;
        const ny = towardCenterY / centerDistance;
        const holdingDistance = destination.radius + 82;
        ship.x = clamp(station.x + nx * holdingDistance, 24, world.width - 24);
        ship.y = clamp(station.y + ny * holdingDistance, 24, world.height - 24);
        ship.vx = 0;
        ship.vy = 0;
        ship.angle = Math.atan2(ny, nx);
    }

    function minimizeWindow(windowElement) {
        windowElement.classList.add("minimized");
        windowElement.setAttribute("aria-hidden", "true");
        if (activeWindow === windowElement) activeWindow = null;
        releaseShipFromDock(windowElement.dataset.window);
        updateTaskButtons();
        canvas.focus();
        wakeRenderer();
    }

    function toggleMaximize(windowElement) {
        const maximizeButton = windowElement.querySelector('[data-window-action="maximize"]');
        const isMaximized = windowElement.classList.toggle("maximized");

        if (isMaximized) {
            windowElement.dataset.restoreLeft = windowElement.style.left;
            windowElement.dataset.restoreTop = windowElement.style.top;
            windowElement.dataset.restoreTransform = windowElement.style.transform;
            windowElement.style.removeProperty("left");
            windowElement.style.removeProperty("top");
            windowElement.style.removeProperty("transform");
        } else {
            windowElement.style.left = windowElement.dataset.restoreLeft || "";
            windowElement.style.top = windowElement.dataset.restoreTop || "";
            windowElement.style.transform = windowElement.dataset.restoreTransform || "";
        }

        if (maximizeButton instanceof HTMLButtonElement) {
            maximizeButton.textContent = isMaximized ? "❐" : "□";
            maximizeButton.setAttribute("aria-label", `${isMaximized ? "❐ Restore" : "□ Maximize"} ${windowElement.dataset.window} file`);
        }
        bringToFront(windowElement);
        beep(isMaximized ? 520 : 420, 0.04, 0.018);
    }

    function closeWindow(windowElement) {
        const id = windowElement.dataset.window;
        windowElement.hidden = true;
        windowElement.classList.remove("minimized", "maximized", "active");
        windowElement.removeAttribute("aria-hidden");
        windowElement.style.removeProperty("left");
        windowElement.style.removeProperty("top");
        windowElement.style.removeProperty("transform");
        delete windowElement.dataset.restoreLeft;
        delete windowElement.dataset.restoreTop;
        delete windowElement.dataset.restoreTransform;
        const maximizeButton = windowElement.querySelector('[data-window-action="maximize"]');
        if (maximizeButton instanceof HTMLButtonElement) {
            maximizeButton.textContent = "□";
            maximizeButton.setAttribute("aria-label", `□ Maximize ${id} file`);
        }
        if (activeWindow === windowElement) activeWindow = null;
        releaseShipFromDock(id);
        taskFiles?.querySelector(`[data-task-file="${id}"]`)?.remove();
        updateTaskButtons();
        setPilotBrief("NAVIGATION RESTORED", "SELECT A MISSION FILE", "Choose a destination to engage autopilot, or fly manually using WASD / ARROWS.");
        canvas.focus();
        wakeRenderer();
    }

    function ensureTaskButton(id) {
        if (!taskFiles || taskFiles.querySelector(`[data-task-file="${id}"]`)) return;
        const destination = destinations.find((item) => item.id === id);
        if (!destination) return;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "task-file";
        button.dataset.taskFile = id;
        button.textContent = destination.file;
        button.addEventListener("click", () => {
            const windowElement = windows.find((item) => item.dataset.window === id);
            if (!windowElement) return;
            if (windowElement.classList.contains("minimized")) {
                windowElement.classList.remove("minimized");
                windowElement.removeAttribute("aria-hidden");
            }
            bringToFront(windowElement);
        });
        taskFiles.appendChild(button);
    }

    function updateTaskButtons() {
        taskFiles?.querySelectorAll(".task-file").forEach((button) => {
            const id = button.dataset.taskFile;
            button.classList.toggle("active", activeWindow?.dataset.window === id && !activeWindow.classList.contains("minimized"));
        });
    }

    function setupWindowManagement() {
        windows.forEach((windowElement) => {
            windowElement.addEventListener("pointerdown", () => bringToFront(windowElement));
            windowElement.querySelectorAll("[data-window-action]").forEach((button) => {
                button.addEventListener("click", (event) => {
                    event.stopPropagation();
                    if (button.dataset.windowAction === "close") closeWindow(windowElement);
                    if (button.dataset.windowAction === "minimize") minimizeWindow(windowElement);
                    if (button.dataset.windowAction === "maximize") toggleMaximize(windowElement);
                });
            });

            const titlebar = windowElement.querySelector(".window-titlebar");
            if (!titlebar) return;
            titlebar.addEventListener("dblclick", (event) => {
                if (window.innerWidth <= 780 || event.target.closest("button")) return;
                toggleMaximize(windowElement);
            });
            titlebar.addEventListener("pointerdown", (event) => {
                if (window.innerWidth <= 780 || windowElement.classList.contains("maximized") || event.target.closest("button")) return;
                event.preventDefault();
                bringToFront(windowElement);
                const layerBounds = document.getElementById("window-layer")?.getBoundingClientRect();
                const windowBounds = windowElement.getBoundingClientRect();
                if (!layerBounds) return;
                const startX = event.clientX;
                const startY = event.clientY;
                const originLeft = windowBounds.left - layerBounds.left;
                const originTop = windowBounds.top - layerBounds.top;
                windowElement.style.left = `${originLeft}px`;
                windowElement.style.top = `${originTop}px`;
                windowElement.style.transform = "none";
                const move = (moveEvent) => {
                    const maxLeft = Math.max(0, layerBounds.width - windowElement.offsetWidth);
                    const maxTop = Math.max(0, layerBounds.height - 42);
                    const left = Math.min(maxLeft, Math.max(0, originLeft + moveEvent.clientX - startX));
                    const top = Math.min(maxTop, Math.max(0, originTop + moveEvent.clientY - startY));
                    windowElement.style.left = `${left}px`;
                    windowElement.style.top = `${top}px`;
                };

                const end = () => {
                    window.removeEventListener("pointermove", move);
                    window.removeEventListener("pointerup", end);
                    window.removeEventListener("pointercancel", end);
                };

                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", end);
                window.addEventListener("pointercancel", end);
            });
        });
    }

    targetButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const destination = destinations.find((item) => item.id === button.dataset.flightTarget);
            if (destination) selectDestination(destination);
        });
        const preview = () => {
            if (selectedTarget || docking) return;
            const destination = destinations.find((item) => item.id === button.dataset.flightTarget);
            if (destination) setPilotBrief("DESTINATION SCAN", destination.label, destination.description, 1800);
        };
        button.addEventListener("pointerenter", preview);
        button.addEventListener("pointerleave", hidePilotBrief);
    });

    initiateLaunchButton?.addEventListener("click", () => beginLaunch(true));
    skipLaunchButton?.addEventListener("click", () => completeLaunch(true));
    replayLaunchButton?.addEventListener("click", replayLaunch);

    canvas.addEventListener("pointermove", (event) => {
        if (selectedTarget || docking) return;
        const bounds = canvas.getBoundingClientRect();
        const point = screenToWorld(event.clientX - bounds.left, event.clientY - bounds.top);
        const target = nearestDestination(point.x, point.y, 28) || null;
        if (target?.id === hoveredTarget?.id) return;
        hoveredTarget = target;
        canvas.style.cursor = target ? "pointer" : "crosshair";
        if (target) setPilotBrief("DESTINATION SCAN", target.label, target.description, 1800);
        else hidePilotBrief();
        wakeRenderer();
    });

    canvas.addEventListener("pointerleave", () => {
        hoveredTarget = null;
        canvas.style.cursor = "crosshair";
    });

    canvas.addEventListener("pointerdown", (event) => {
        if (docking) return;
        const bounds = canvas.getBoundingClientRect();
        const screenX = event.clientX - bounds.left;
        const screenY = event.clientY - bounds.top;
        const point = screenToWorld(screenX, screenY);
        const destination = nearestDestination(point.x, point.y, 28);
        if (destination) {
            selectDestination(destination);
            return;
        }
        selectedTarget = null;
        manualTarget = {
            x: clamp(point.x, 18, world.width - 18),
            y: clamp(point.y, 18, world.height - 18)
        };
        targetButtons.forEach((button) => button.classList.remove("active"));
        setStatus("MANUAL VECTOR");
        setPilotBrief("MANUAL VECTOR SET", `X ${Math.round(manualTarget.x)} / Y ${Math.round(manualTarget.y)}`, "Autopilot is steering to the selected coordinate.", 1900);
        beep(430, 0.04, 0.018);
        canvas.focus();
        wakeRenderer();
    });

    window.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();
        if (key === "escape") {
            if (launchSequence && !launchSequence.classList.contains("complete")) {
                completeLaunch();
                return;
            }
            if (systemMenu && !systemMenu.hidden) {
                closeSystemMenu();
            } else if (window.innerWidth <= 780 && missionFiles?.classList.contains("open")) {
                setMissionDirectory(false);
            } else if (activeWindow) {
                closeWindow(activeWindow);
            }
            return;
        }

        if ((event.ctrlKey || event.metaKey) && key === "w" && activeWindow) {
            event.preventDefault();
            closeWindow(activeWindow);
            return;
        }

        if (activeWindow) return;
        if (["arrowleft", "arrowright", "arrowup", "arrowdown", "w", "a", "s", "d"].includes(key)) {
            event.preventDefault();
            keys.add(key);
            setStatus("MANUAL THRUST");
            wakeRenderer();
        }
    });

    window.addEventListener("keyup", (event) => {
        keys.delete(event.key.toLowerCase());
        if (keys.size === 0 && !selectedTarget && !docking) setStatus("ORBITAL HOLD");
        wakeRenderer();
    });

    missionToggle?.addEventListener("click", () => {
        const open = window.innerWidth <= 780
            ? !missionFiles?.classList.contains("open")
            : Boolean(missionFiles?.classList.contains("collapsed"));
        closeSystemMenu();
        setMissionDirectory(open);
        if (open) {
            hidePilotBrief();
            missionFiles?.querySelector("button")?.focus();
        }
        wakeRenderer();
    });

    systemToggle?.addEventListener("click", () => {
        if (!systemMenu) return;
        const open = systemMenu.hidden;
        systemMenu.hidden = !open;
        systemToggle.setAttribute("aria-expanded", String(open));
        if (open) {
            setMissionDirectory(false);
            hidePilotBrief();
            systemMenu.querySelector("button")?.focus();
        }
    });

    document.addEventListener("pointerdown", (event) => {
        if (!systemMenu || systemMenu.hidden) return;
        if (systemMenu.contains(event.target) || systemToggle?.contains(event.target)) return;
        closeSystemMenu();
    });

    soundToggle?.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        updateSoundButton();
        if (soundEnabled) ensureAudio();
        beep(650, 0.075, 0.03);
    });

    window.addEventListener("resize", () => {
        resizeCanvas();
        if (window.innerWidth <= 780) {
            missionFiles?.classList.remove("collapsed");
            missionToggle?.setAttribute("aria-expanded", String(Boolean(missionFiles?.classList.contains("open"))));
        } else {
            missionFiles?.classList.remove("open");
            missionToggle?.setAttribute("aria-expanded", String(!missionFiles?.classList.contains("collapsed")));
        }
        wakeRenderer();
    }, { passive: true });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            pauseRenderer("hidden");
            fadeEngine();
            audioContext?.suspend();
        } else {
            if (soundEnabled) audioContext?.resume();
            lastTime = performance.now();
            wakeRenderer();
        }
    });

    runBoot();
    updateClock();
    window.setInterval(updateClock, 1000);
    updateSoundButton();
    updateDiscovery();
    setupWindowManagement();
    resizeCanvas();
    wakeRenderer();

    window.addEventListener("pagehide", () => {
        pauseRenderer("page-hidden");
        fadeEngine();
        audioContext?.suspend();
    }, { once: true });
})();
