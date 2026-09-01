(() => {
    "use strict";

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.querySelectorAll("[data-current-year]").forEach((element) => {
        element.textContent = String(new Date().getFullYear());
    });

    const heroCurtains = document.querySelector(".hero-curtains");
    const finalCurtain = heroCurtains?.lastElementChild;
    if (heroCurtains && finalCurtain) {
        finalCurtain.addEventListener("animationend", () => {
            heroCurtains.classList.add("is-complete");
        }, { once: true });
    }

    const reveals = Array.from(document.querySelectorAll(".reveal"));
    if (!reducedMotion && "IntersectionObserver" in window) {
        document.documentElement.classList.add("motion-ready");
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        }, { rootMargin: "0px 0px -7%", threshold: 0.08 });
        reveals.forEach((element) => observer.observe(element));
    } else {
        reveals.forEach((element) => element.classList.add("is-visible"));
    }

    const activityGrid = document.querySelector("[data-activity-grid]");
    if (activityGrid) {
        const activityWeeks = [
            "0000000", "0000000", "0000111", "1111111",
            "0111110", "1111101", "0011111", "1111100",
            "1111110", "0000111", "1111000", "0011111", "1111211",
            "1111121", "1111111", "1232111", "1211121", "1111111",
            "0100000", "0000110", "0011110", "1111111",
            "1111111", "1112111", "0111111", "1110111",
            "1111111", "1100111", "1111111", "1111111",
            "1111111", "1111324", "4442221", "1112111",
            "1211142", "1210000"
        ];
        const fragment = document.createDocumentFragment();
        activityWeeks.forEach((week) => {
            Array.from(week).forEach((level) => {
                const cell = document.createElement("i");
                cell.dataset.level = level;
                fragment.appendChild(cell);
            });
        });
        activityGrid.appendChild(fragment);
    }
})();
