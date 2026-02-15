"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Avatar from "@/components/ui/Avatar";
import { Plus, Trash, MagnifyingGlass, X, UsersThree } from "@phosphor-icons/react";
import type { Group, User } from "@/types";

interface GroupWithMembers extends Group {
  members: User[];
}

interface GroupsPageClientProps {
  groups: GroupWithMembers[];
  userId: string;
  followers: User[];
}

const colorOptions = [
  "#ec4899", "#6366f1", "#8b5cf6", "#06b6d4",
  "#10b981", "#f59e0b", "#ef4444", "#64748b",
];

export default function GroupsPageClient({ groups: initialGroups, userId, followers }: GroupsPageClientProps) {
  const [groups, setGroups] = useState<GroupWithMembers[]>(initialGroups);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [creating, setCreating] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);

    const { data, error } = await supabase
      .from("groups")
      .insert({ owner_id: userId, name: newName.trim(), color: newColor })
      .select()
      .single();

    if (!error && data) {
      setGroups([...groups, { ...data, members: [] }]);
      setNewName("");
      setNewColor("#6366f1");
      setShowCreate(false);
    }
    setCreating(false);
  }

  async function handleDelete(groupId: string) {
    await supabase.from("groups").delete().eq("id", groupId);
    setGroups(groups.filter((g) => g.id !== groupId));
  }

  async function addMember(groupId: string, user: User) {
    const { error } = await supabase
      .from("group_members")
      .insert({ group_id: groupId, user_id: user.id });

    if (!error) {
      setGroups(groups.map((g) =>
        g.id === groupId
          ? { ...g, members: [...g.members, user] }
          : g
      ));
      setSearchQuery("");
    }
  }

  async function removeMember(groupId: string, memberId: string) {
    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", memberId);

    setGroups(groups.map((g) =>
      g.id === groupId
        ? { ...g, members: g.members.filter((m) => m.id !== memberId) }
        : g
    ));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-text-primary mb-1">Audience Lists</h1>
          <p className="text-sm text-text-secondary">Personal lists for controlling who sees your posts. Only you manage these.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={16} weight="bold" />
          New list
        </Button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-lg border border-border bg-surface p-4 space-y-3">
          <Input
            label="List name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Work buddies"
            required
          />
          <div>
            <label className="text-sm font-medium text-text-primary mb-1.5 block">Color</label>
            <div className="flex gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewColor(color)}
                  className={`w-7 h-7 rounded-full cursor-pointer transition-transform ${
                    newColor === color ? "ring-2 ring-offset-2 ring-offset-surface ring-secondary scale-110" : ""
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={creating}>Create</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {groups.map((group) => {
          const isExpanded = expandedGroup === group.id;

          return (
            <ExpandedGroup
              key={group.id}
              group={group}
              isExpanded={isExpanded}
              followers={followers}
              searchQuery={isExpanded ? searchQuery : ""}
              onToggle={() => {
                setExpandedGroup(isExpanded ? null : group.id);
                setSearchQuery("");
              }}
              onSearchChange={setSearchQuery}
              onAdd={(user) => addMember(group.id, user)}
              onRemove={(memberId) => removeMember(group.id, memberId)}
              onDelete={() => handleDelete(group.id)}
            />
          );
        })}

        {groups.length === 0 && (
          <div className="text-center py-12">
            <UsersThree size={32} className="mx-auto text-text-secondary mb-2" />
            <p className="text-text-secondary text-sm">No lists yet. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpandedGroup({
  group,
  isExpanded,
  followers,
  searchQuery,
  onToggle,
  onSearchChange,
  onAdd,
  onRemove,
  onDelete,
}: {
  group: GroupWithMembers;
  isExpanded: boolean;
  followers: User[];
  searchQuery: string;
  onToggle: () => void;
  onSearchChange: (q: string) => void;
  onAdd: (user: User) => void;
  onRemove: (memberId: string) => void;
  onDelete: () => void;
}) {
  const memberIds = useMemo(() => new Set(group.members.map((m) => m.id)), [group.members]);

  const filteredFollowers = useMemo(() => {
    const available = followers.filter((f) => !memberIds.has(f.id));
    if (!searchQuery || searchQuery.length < 1) return available;
    const q = searchQuery.toLowerCase();
    return available.filter(
      (f) => f.username.toLowerCase().includes(q) || f.display_name.toLowerCase().includes(q)
    );
  }, [followers, memberIds, searchQuery]);

  return (
    <div className="rounded-lg border border-border bg-surface">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-background/50 transition-colors rounded-lg"
      >
        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">{group.name}</p>
          <p className="text-xs text-text-secondary">{group.members.length} members</p>
        </div>
        {group.is_default && (
          <span className="text-xs text-text-secondary bg-background px-2 py-0.5 rounded">Default</span>
        )}
        {!group.is_default && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-text-secondary hover:text-error transition-colors p-1 cursor-pointer"
            title="Delete list"
          >
            <Trash size={16} />
          </button>
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50">
          <div className="pt-3 relative">
            <div className="flex items-center gap-2 border border-border rounded-md px-2.5 py-1.5 bg-background">
              <MagnifyingGlass size={16} className="text-text-secondary shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search your followers..."
                className="flex-1 text-sm bg-transparent text-text-primary placeholder:text-text-secondary/50 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => onSearchChange("")} className="cursor-pointer">
                  <X size={14} className="text-text-secondary" />
                </button>
              )}
            </div>
            {searchQuery.length >= 1 && filteredFollowers.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-surface border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredFollowers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => onAdd(user)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-background/50 text-left cursor-pointer"
                  >
                    <Avatar src={user.avatar_url} name={user.display_name} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-text-primary">{user.display_name}</p>
                      <p className="text-xs text-text-secondary">@{user.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 1 && filteredFollowers.length === 0 && (
              <p className="text-xs text-text-secondary mt-1.5">
                No matching followers. People need to follow you before you can add them.
              </p>
            )}
          </div>

          {group.members.length === 0 ? (
            <div className="flex items-center gap-2 py-3 text-text-secondary">
              <UsersThree size={16} />
              <p className="text-sm">No members yet. Search your followers to add people.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {group.members.map((member) => (
                <div key={member.id} className="flex items-center gap-2.5 py-1.5">
                  <Avatar src={member.avatar_url} name={member.display_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{member.display_name}</p>
                    <p className="text-xs text-text-secondary truncate">@{member.username}</p>
                  </div>
                  <button
                    onClick={() => onRemove(member.id)}
                    className="text-text-secondary hover:text-error transition-colors p-1 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
