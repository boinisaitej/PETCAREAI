"use client";
import { useEffect, useState } from "react";
import { petsApi } from "@/lib/api";

export const speciesEmoji = (species?: string) => {
  const map: Record<string, string> = {
    dog: "🐕", cat: "🐈", bird: "🦜", rabbit: "🐇", fish: "🐠",
    hamster: "🐹", reptile: "🦎", horse: "🐴", ferret: "🦡",
    snake: "🐍", turtle: "🐢",
  };
  return map[(species || "").toLowerCase()] || "🐾";
};

interface Pet {
  id: number;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  weight?: number;
  allergies?: string;
}

interface PetPickerProps {
  selected: number | null;
  onSelect: (id: number, pet: Pet) => void;
  onLoaded?: (pets: Pet[]) => void;
}

/** Reusable pet selector pill row — auto-selects the first pet on load. */
export default function PetPicker({ selected, onSelect, onLoaded }: PetPickerProps) {
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    petsApi.list().then((r) => {
      setPets(r.data);
      onLoaded?.(r.data);
      if (r.data.length > 0 && selected === null) onSelect(r.data[0].id, r.data[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (pets.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
      <label className="block text-sm font-medium text-gray-700 mb-2">Select Pet</label>
      <div className="flex gap-2 flex-wrap">
        {pets.map((p) => (
          <button key={p.id} onClick={() => onSelect(p.id, p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selected === p.id ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            {speciesEmoji(p.species)} {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
