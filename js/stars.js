// Widget de estrellas reutilizable, sin dependencias.

export function renderStarsInto(container, { value = 0, readOnly = false, small = false, onChange } = {}) {
  container.innerHTML = "";
  container.classList.add("stars");
  if (readOnly) container.classList.add("readonly");
  if (small) container.classList.add("small");

  let current = value;

  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const s = document.createElement("span");
    s.className = "star" + (i <= Math.round(current) ? " filled" : "");
    s.textContent = "★";
    if (!readOnly) {
      s.addEventListener("click", () => {
        current = i;
        stars.forEach((st, idx) => st.classList.toggle("filled", idx < current));
        if (onChange) onChange(current);
      });
    }
    stars.push(s);
    container.appendChild(s);
  }

  return {
    setValue(v) {
      current = v;
      stars.forEach((st, idx) => st.classList.toggle("filled", idx < Math.round(current)));
    },
    getValue() {
      return current;
    },
  };
}

export function averageOf(ratings, field) {
  const vals = ratings.map((r) => r[field]).filter((v) => typeof v === "number" && v > 0);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function formatAvg(avg, count) {
  if (count === 0) return "Sin votos";
  return `${avg.toFixed(1)} ★ (${count})`;
}
