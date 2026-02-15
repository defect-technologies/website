"use client";

import Link from "next/link";
import { UsersThree, Trophy } from "@phosphor-icons/react";
import type { Circle } from "@/types";

interface CircleCardProps {
  circle: Circle;
}

export default function CircleCard({ circle }: CircleCardProps) {
  return (
    <Link
      href={`/c/${circle.id}`}
      className="block rounded-lg border border-border bg-surface p-4 hover:border-secondary/40 transition-colors"
    >
      <h3 className="font-serif font-semibold text-text-primary">{circle.name}</h3>
      {circle.description && (
        <p className="text-sm text-text-secondary mt-1 line-clamp-2">{circle.description}</p>
      )}
      <div className="flex items-center gap-4 mt-3 text-xs text-text-secondary">
        <span className="inline-flex items-center gap-1">
          <UsersThree size={14} />
          {circle.member_count} {circle.member_count === 1 ? "member" : "members"}
        </span>
        {circle.prize_description && (
          <span className="inline-flex items-center gap-1 text-accent">
            <Trophy size={14} weight="fill" />
            {circle.prize_description}
          </span>
        )}
      </div>
    </Link>
  );
}
