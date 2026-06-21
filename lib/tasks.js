const TASK_RE = /^\s*-\s+\[(?<mark>[ xX])\]\s+(?<label>.+?)\s*$/u;
const EVIDENCE_RE = /^\s*(?:-\s*)?Evidence:\s*(?<text>.+?)\s*$/iu;

export function parseTasks(content) {
  const tasks = [];
  let current = null;

  for (const line of content.split(/\r?\n/u)) {
    const taskMatch = TASK_RE.exec(line);

    if (taskMatch?.groups) {
      current = {
        label: taskMatch.groups.label.trim(),
        done: taskMatch.groups.mark.toLowerCase() === "x",
        evidence: []
      };
      tasks.push(current);
      continue;
    }

    const evidenceMatch = EVIDENCE_RE.exec(line);
    if (current && evidenceMatch?.groups) {
      current.evidence.push(evidenceMatch.groups.text.trim());
    }
  }

  return tasks;
}
