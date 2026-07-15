import { ImageSphere } from "./image-sphere.js";

const host = document.getElementById("sphere-host");
if (host) {
  const images = Array.from({ length: 10 }, (_, i) => `assets/img/sphere/${i + 1}.svg`);
  const sphere = new ImageSphere(host, images);
  sphere.start();
}
