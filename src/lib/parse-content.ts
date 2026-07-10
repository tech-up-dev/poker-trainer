// Parsers that turn CSV and Markdown into the same plain objects the JSON bulk
// import already produces, so they flow through the identical detectAndValidate +
// save-to-staging path (issue #29). The formats map onto the existing schemas;
// see docs/schema-spec.md for the column and section conventions.

// Columns whose CSV cell holds a delimited list rather than a scalar. Split on
// the pipe so commas can appear inside a value.
const CSV_ARRAY_FIELDS = new Set(['tags', 'related_terms'])

// Parse CSV text into one object per data row, keyed by the header row. Handles
// quoted fields containing commas, newlines, and "" escaped quotes. Empty cells
// are omitted so optional schema fields stay unset. Best for the flat content
// types (glossary, tip, reference); lessons use the Markdown path.
export function parseCsv(text: string): Record<string, unknown>[] {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return []

  const headers = rows[0].map((h) => h.trim())
  const items: Record<string, unknown>[] = []

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (row.every((cell) => cell.trim() === '')) continue

    const obj: Record<string, unknown> = {}
    headers.forEach((key, i) => {
      if (key === '') return
      const raw = (row[i] ?? '').trim()
      if (raw === '') return
      if (CSV_ARRAY_FIELDS.has(key)) {
        obj[key] = raw
          .split('|')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      } else {
        obj[key] = raw
      }
    })
    items.push(obj)
  }

  return items
}

// Split raw CSV into rows of string cells, honoring RFC-4180 quoting.
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += ch
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

type MarkdownAnswer = { text: string; is_correct: boolean; explanation: string }
type MarkdownQuestion = {
  question_id: string
  type: 'multiple_choice'
  prompt: string
  answers: MarkdownAnswer[]
  glossary_terms?: string[]
}

// Parse a prose-authored Markdown lesson into a Lesson object. Structure:
//   # Lesson title
//   - principle_tag: character_mapping
//   - concept: cbet_sizing_dry_boards
//   - difficulty: intermediate        (optional)
//   ## Q: the question prompt
//   - [ ] wrong answer :: why it is wrong
//   - [x] correct answer :: why it is right
//   > glossary: c-bet, dry board       (optional)
// Only multiple_choice questions; hand scenarios need the table builder or JSON.
export function parseMarkdownLesson(text: string): Record<string, unknown> {
  const lines = text.split(/\r?\n/)
  const lesson: Record<string, unknown> = {}
  const questions: MarkdownQuestion[] = []
  let current: { prompt: string; answers: MarkdownAnswer[]; glossary_terms: string[] } | null = null

  const flush = (): void => {
    if (current === null) return
    const q: MarkdownQuestion = {
      question_id: `q${questions.length + 1}`,
      type: 'multiple_choice',
      prompt: current.prompt,
      answers: current.answers,
    }
    if (current.glossary_terms.length > 0) q.glossary_terms = current.glossary_terms
    questions.push(q)
  }

  for (const line of lines) {
    const t = line.trim()
    if (t === '') continue

    if (t.startsWith('# ')) {
      lesson.title = t.slice(2).trim()
      continue
    }

    if (t.toLowerCase().startsWith('## q:')) {
      flush()
      current = { prompt: t.slice(5).trim(), answers: [], glossary_terms: [] }
      continue
    }

    // Metadata lines ("- key: value") only count before the first question.
    const meta = current === null ? t.match(/^-\s+([a-z_]+):\s*(.+)$/i) : null
    if (meta) {
      lesson[meta[1].trim()] = meta[2].trim()
      continue
    }

    const answer = current !== null ? t.match(/^-\s*\[([ xX])\]\s*(.+)$/) : null
    if (current !== null && answer) {
      const [textPart, explPart] = splitOnce(answer[2], '::')
      current.answers.push({
        text: textPart.trim(),
        is_correct: answer[1].toLowerCase() === 'x',
        explanation: (explPart ?? '').trim(),
      })
      continue
    }

    const glossary = current !== null ? t.match(/^>\s*glossary:\s*(.+)$/i) : null
    if (current !== null && glossary) {
      current.glossary_terms = glossary[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      continue
    }
  }

  flush()
  lesson.questions = questions
  return lesson
}

function splitOnce(value: string, sep: string): [string, string | undefined] {
  const idx = value.indexOf(sep)
  if (idx === -1) return [value, undefined]
  return [value.slice(0, idx), value.slice(idx + sep.length)]
}
