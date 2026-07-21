import { createRoot } from "react-dom/client";
import { Index } from "./routes/index";
import "./styles.css";

const root = document.getElementById("root");

if (!root) throw new Error("Elemento raiz da aplicação não encontrado.");

createRoot(root).render(<Index />);
