import { describe, expect, it } from "vitest";
import { deviceDisplayName, isTechnicalDeviceName } from "./admin.service";

describe("admin device presentation", () => {
  it("não apresenta aparelhos técnicos como celulares da equipe", () => {
    expect(isTechnicalDeviceName("Auditoria de produção")).toBe(true);
    expect(isTechnicalDeviceName("Auditoria Romano")).toBe(true);
    expect(isTechnicalDeviceName("Restauração auditada de atendimento")).toBe(true);
    expect(isTechnicalDeviceName("Mozilla/5.0 HeadlessChrome/149 Safari/537")).toBe(true);
    expect(isTechnicalDeviceName("Mozilla/5.0 Linux Android 10 Mobile Safari/537")).toBe(false);
  });

  it("traduz o user agent para um nome compreensível", () => {
    expect(deviceDisplayName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7)")).toBe("iPhone");
    expect(deviceDisplayName("Mozilla/5.0 (Linux; Android 10; K) Mobile")).toBe(
      "Celular ou tablet Android",
    );
    expect(deviceDisplayName("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
      "Computador Windows",
    );
  });
});
