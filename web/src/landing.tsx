import { render } from "solid-js/web";
import BookOpen from "lucide-solid/icons/book-open";
import FileDown from "lucide-solid/icons/file-down";
import Grid2x2 from "lucide-solid/icons/grid-2x2";
import ImageUp from "lucide-solid/icons/image-up";
import Pencil from "lucide-solid/icons/pencil";

const icons = {
  "book-open": BookOpen,
  "file-down": FileDown,
  grid: Grid2x2,
  "image-up": ImageUp,
  pencil: Pencil,
};

document
  .querySelectorAll<HTMLElement>("[data-lucide-icon]")
  .forEach((element) => {
    const name = element.dataset.lucideIcon as keyof typeof icons;
    const Icon = icons[name];
    if (Icon) render(() => <Icon aria-hidden="true" />, element);
  });
