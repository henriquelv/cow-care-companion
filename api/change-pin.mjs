import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const PIN_PATTERN = /^\d{4,6}$/;

function reply(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  return response.status(status).json(body);
}

export default async function changePin(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return reply(response, 405, { ok: false, message: "Método não permitido." });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    return reply(response, 503, { ok: false, message: "Serviço de PIN indisponível." });
  }

  const { clientId, employeeId, currentPin, newPin } = request.body ?? {};
  if (
    typeof clientId !== "string" ||
    typeof employeeId !== "string" ||
    typeof currentPin !== "string" ||
    typeof newPin !== "string" ||
    !PIN_PATTERN.test(currentPin) ||
    !PIN_PATTERN.test(newPin)
  ) {
    return reply(response, 400, { ok: false, message: "Informe PINs de 4 a 6 números." });
  }
  if (currentPin === newPin) {
    return reply(response, 400, { ok: false, message: "Escolha um PIN diferente do atual." });
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: employee, error: readError } = await supabase
    .from("employees")
    .select("id,client_id,password_hash,status")
    .eq("id", employeeId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (readError) return reply(response, 500, { ok: false, message: "Falha ao validar o PIN." });
  if (!employee || employee.status !== "active" || !employee.password_hash) {
    return reply(response, 403, { ok: false, message: "Funcionário inativo ou inválido." });
  }

  const currentPinIsValid = await bcrypt.compare(currentPin, employee.password_hash);
  if (!currentPinIsValid) {
    return reply(response, 403, { ok: false, message: "PIN atual incorreto." });
  }

  const passwordHash = (await bcrypt.hash(newPin, 12)).replace(/^\$2b\$/, "$2a$");
  const { error: updateError } = await supabase
    .from("employees")
    .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
    .eq("id", employee.id)
    .eq("client_id", clientId);

  if (updateError) {
    return reply(response, 500, { ok: false, message: "Não foi possível salvar o novo PIN." });
  }
  return reply(response, 200, { ok: true });
}
