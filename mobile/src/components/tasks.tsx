// Verkefnalisti vaktar — hakanlegur fyrir eigandann, annars aðeins til skoðunar.
import React from "react";
import { View, Pressable } from "react-native";
import { Check } from "lucide-react-native";
import { Txt } from "./ui";
import { colors } from "../theme";
import type { Task } from "../lib/api/tasks";

export function TaskChecklist({ tasks, onToggle }: { tasks: Task[]; onToggle?: (t: Task) => void }) {
  return (
    <View>
      {tasks.map((task) => (
        <Pressable
          key={task.id}
          disabled={!onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done, disabled: !onToggle }}
          onPress={() => onToggle?.(task)}
          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: onToggle ? 10 : 6, opacity: pressed ? 0.7 : 1 })}
        >
          <View style={{ width: onToggle ? 24 : 18, height: onToggle ? 24 : 18, borderRadius: onToggle ? 7 : 5, borderWidth: 1.5, borderColor: task.done ? colors.good : colors.line, backgroundColor: task.done ? colors.good : "transparent", alignItems: "center", justifyContent: "center" }}>
            {task.done ? <Check color="#fff" size={onToggle ? 15 : 12} strokeWidth={3} /> : null}
          </View>
          <Txt size={onToggle ? 15 : 13.5} color={task.done ? colors.ink3 : colors.ink} style={{ flex: 1, textDecorationLine: task.done ? "line-through" : "none" }}>{task.title}</Txt>
        </Pressable>
      ))}
    </View>
  );
}
