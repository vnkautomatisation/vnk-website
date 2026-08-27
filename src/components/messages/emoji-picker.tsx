"use client";
// Picker d'emojis inline — grille categorisable, zero dependance externe
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CATEGORIES: { name: string; emojis: string[] }[] = [
  {
    name: "Visages",
    emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪","😝","🤗","🤔","🤭","🫢","🤫","🤥","😐","😑","😶","🫥","😏","😒","🙄","😬","🤐","😌","😔","😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶","😵","🤯","🤠","🥳","😎","🤓","🧐"],
  },
  {
    name: "Sentiments",
    emojis: ["😢","😭","😤","😠","😡","🤬","🤯","😳","🥺","😱","😨","😰","😥","😓","🤗","🤔","🫡","🤝","🙏","👏","🙌","🤲","💪","🫶","❤️","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣️","💕","💞","💓","💗","💖","💘","💝"],
  },
  {
    name: "Gestes",
    emojis: ["👍","👎","👌","✌️","🤞","🫰","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","✋","🤚","🖐️","🖖","👋","🤝","🙏","✊","👊","🤛","🤜","💪","🦾","🦵","🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦"],
  },
  {
    name: "Objets",
    emojis: ["✅","❌","⚠️","❗","❓","💡","💯","🔥","⭐","🌟","✨","🎉","🎊","🎁","🏆","🥇","🥈","🥉","📌","📍","📎","🖇️","📏","📐","🔒","🔓","🔑","🗝️","🔨","🛠️","⚙️","🔧","📂","📁","📅","📆","📇","📊","📈","📉","💼","💻","⌨️","🖱️","🖨️","📱","☎️","📞","📧","📨","📤","📥","📦","📃","📄","📑","🧾","📜","📋","📝","✏️","✒️","🖊️","🖋️","🖌️","🖍️"],
  },
  {
    name: "Industriel",
    emojis: ["🏭","🏗️","🏢","🏪","🏨","⚡","🔌","🔋","🛰️","🚀","🤖","🦾","⚙️","🔧","🔨","🛠️","⛏️","🪛","🪚","🔩","⛑️","🦺","👷","👨‍🔧","👩‍🔧","👨‍🏭","👩‍🏭","👨‍💻","👩‍💻"],
  },
  {
    name: "Symboles",
    emojis: ["💯","🔢","♻️","✳️","❇️","➕","➖","➗","✖️","💲","💱","💵","💴","💶","💷","💰","💳","🧮","📊","📈","📉","🆕","🆗","🆙","🆒","🆓","🅿️","🆘","⛔","🚫","❎","✔️","☑️","🔘","⚪","⚫","🔴","🟠","🟡","🟢","🔵","🟣","🟤","🔺","🔻","🔸","🔹","🔶","🔷","🔳","🔲"],
  },
];

export function EmojiPicker({ onSelect, className }: { onSelect: (emoji: string) => void; className?: string }) {
  const t = useTranslations("admin.messages");
  const [activeCat, setActiveCat] = useState(0);
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("h-9 w-9 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors", className)}
          aria-label={t("inserer_emoji")}
        >
          <Smile className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] p-0" align="end" side="top">
        <div className="border-b p-2 flex gap-1 overflow-x-auto">
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => setActiveCat(i)}
              className={cn(
                "px-2 py-1 text-[10px] font-medium rounded-md whitespace-nowrap transition-colors",
                activeCat === i ? "bg-[#0F2D52] text-white" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <div className="p-2 grid grid-cols-8 gap-0.5 max-h-[240px] overflow-y-auto">
          {CATEGORIES[activeCat].emojis.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { onSelect(e); }}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-muted text-lg transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
