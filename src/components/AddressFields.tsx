import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type Address = {
  cep: string; street: string; number: string; complement: string;
  neighborhood: string; city: string; state: string; delivery_notes: string;
};

export const emptyAddress: Address = { cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", delivery_notes: "" };

export function AddressFields({ value, onChange }: { value: Address; onChange: (a: Address) => void }) {
  const set = (k: keyof Address, v: string) => onChange({ ...value, [k]: v });

  const lookupCep = async (cep: string) => {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const j = await r.json();
      if (!j.erro) onChange({ ...value, cep, street: j.logradouro || value.street, neighborhood: j.bairro || value.neighborhood, city: j.localidade || value.city, state: j.uf || value.state });
    } catch {}
  };

  return (
    <div className="grid grid-cols-6 gap-4">
      <div className="col-span-6 sm:col-span-2"><Label>CEP</Label><Input required value={value.cep} onChange={(e) => set("cep", e.target.value)} onBlur={(e) => lookupCep(e.target.value)} placeholder="00000-000" /></div>
      <div className="col-span-6 sm:col-span-4"><Label>Rua</Label><Input required value={value.street} onChange={(e) => set("street", e.target.value)} /></div>
      <div className="col-span-2"><Label>Número</Label><Input required value={value.number} onChange={(e) => set("number", e.target.value)} /></div>
      <div className="col-span-4"><Label>Complemento</Label><Input value={value.complement} onChange={(e) => set("complement", e.target.value)} /></div>
      <div className="col-span-6 sm:col-span-3"><Label>Bairro</Label><Input required value={value.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} /></div>
      <div className="col-span-4 sm:col-span-2"><Label>Cidade</Label><Input required value={value.city} onChange={(e) => set("city", e.target.value)} /></div>
      <div className="col-span-2 sm:col-span-1"><Label>UF</Label><Input required maxLength={2} value={value.state} onChange={(e) => set("state", e.target.value.toUpperCase())} /></div>
      <div className="col-span-6"><Label>Local de entrega / referência</Label><Textarea value={value.delivery_notes} onChange={(e) => set("delivery_notes", e.target.value)} placeholder="Ex.: deixar na portaria, casa com portão branco…" /></div>
    </div>
  );
}
