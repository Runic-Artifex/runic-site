// Excerpts of the Runic application template's counter page. Each line may
// belong to one member of the generated contract; «member|text» marks the
// name that crosses between C# and TypeScript.

export type Member = 'count' | 'step' | 'increment';
type Line = readonly [Member | null, string];

export type Snippet = {
  id: string;
  label: string;
  file: string;
  lines: readonly Line[];
};

export type Token = { text: string; member?: Member };

export const members: readonly {
  id: Member;
  name: string;
  role: string;
  direction: 'to-frontend' | 'both' | 'to-dotnet';
}[] = [
  {
    id: 'count',
    name: 'count',
    role: 'Read-only: the setter is private in C#.',
    direction: 'to-frontend',
  },
  {
    id: 'step',
    name: 'step, setStep',
    role: 'Two-way: the setter is public.',
    direction: 'both',
  },
  {
    id: 'increment',
    name: 'increment()',
    role: 'A command the frontend runs.',
    direction: 'to-dotnet',
  },
];

export const viewModels: readonly Snippet[] = [
  {
    id: 'reactiveui',
    label: 'ReactiveUI',
    file: 'Counter.cs',
    lines: [
      [null, 'public sealed class CounterViewModel : ReactiveObject'],
      [null, '{'],
      [null, '    private int _count;'],
      [null, '    private int _step = 1;'],
      [null, ''],
      [null, '    public CounterViewModel() =>'],
      [
        'increment',
        '        «increment|IncrementCommand» = ReactiveCommand.Create(',
      ],
      ['increment', '            () => { Count += Step; });'],
      [null, ''],
      ['count', '    public int «count|Count»'],
      ['count', '    {'],
      ['count', '        get => _count;'],
      ['count', '        private set =>'],
      ['count', '            this.RaiseAndSetIfChanged(ref _count, value);'],
      ['count', '    }'],
      [null, ''],
      ['step', '    public int «step|Step»'],
      ['step', '    {'],
      ['step', '        get => _step;'],
      ['step', '        set => this.RaiseAndSetIfChanged(ref _step, value);'],
      ['step', '    }'],
      [null, ''],
      [
        'increment',
        '    public ReactiveCommand<RxVoid, RxVoid> «increment|IncrementCommand» { get; }',
      ],
      [null, '}'],
      [null, ''],
      [null, 'public sealed partial class CounterView'],
      [null, '    : ReactiveRunicView<CounterViewModel>;'],
    ],
  },
  {
    id: 'toolkit',
    label: 'CommunityToolkit.Mvvm',
    file: 'Counter.cs',
    lines: [
      [null, 'public sealed partial class CounterViewModel : ObservableObject'],
      [null, '{'],
      [null, '    public CounterViewModel() => Step = 1;'],
      [null, ''],
      ['count', '    [ObservableProperty]'],
      ['count', '    public partial int «count|Count» { get; private set; }'],
      [null, ''],
      ['step', '    [ObservableProperty]'],
      ['step', '    public partial int «step|Step» { get; set; }'],
      [null, ''],
      ['increment', '    [RelayCommand]'],
      [
        'increment',
        '    private void «increment|Increment»() => Count += Step;',
      ],
      [null, '}'],
      [null, ''],
      [null, 'public sealed partial class CounterView'],
      [null, '    : RunicView<CounterViewModel>;'],
    ],
  },
];

export const frontends: readonly Snippet[] = [
  {
    id: 'react',
    label: 'React',
    file: 'CounterPage.tsx',
    lines: [
      [null, 'export function CounterPage('],
      [null, '  { page }: { page: CounterPageReference },'],
      [null, ') {'],
      [null, '  const { state, client } = useView(page);'],
      [
        'increment',
        '  const increment = useCommand(() => client?.«increment|increment»());',
      ],
      ['step', '  const setStep = useCommand('],
      ['step', '    (step: number) => client?.«step|setStep»(step));'],
      [null, ''],
      [null, '  return <section>'],
      ['count', '    <p className="count">{state?.«count|count» ?? "…"}</p>'],
      ['step', '    <select value={state?.«step|step» ?? 1}'],
      ['step', '      onChange={event =>'],
      ['step', '        void setStep.run(Number(event.currentTarget.value))}>'],
      [null, '      {steps.map(step => <option key={step}>{step}</option>)}'],
      [null, '    </select>'],
      ['increment', '    <button onClick={() => void increment.run()}>'],
      ['increment', '      Increment'],
      ['increment', '    </button>'],
      [null, '  </section>;'],
      [null, '}'],
    ],
  },
  {
    id: 'vue',
    label: 'Vue',
    file: 'CounterPage.vue',
    lines: [
      [null, '<script setup lang="ts">'],
      [null, 'const props = defineProps<{ page: CounterPageReference }>();'],
      [null, 'const { state, client } = useView(() => props.page);'],
      [
        'increment',
        'const increment = useCommand(() => client.value?.«increment|increment»());',
      ],
      ['step', 'const setStep = useCommand('],
      ['step', '  (value: number) => client.value?.«step|setStep»(value));'],
      ['step', 'const step = computed({'],
      ['step', '  get: () => state.value?.«step|step» ?? 1,'],
      ['step', '  set: value => void setStep.run(value),'],
      ['step', '});'],
      [null, '</script>'],
      [null, ''],
      [null, '<template>'],
      ['count', '  <p class="count">{{ state?.«count|count» ?? "…" }}</p>'],
      ['step', '  <select v-model.number="step">'],
      [null, '    <option v-for="value in [1, 2, 5, 10]" :key="value"'],
      [null, '      :value="value">{{ value }}</option>'],
      [null, '  </select>'],
      ['increment', '  <button @click="increment.run()">Increment</button>'],
      [null, '</template>'],
    ],
  },
  {
    id: 'svelte',
    label: 'Svelte',
    file: 'CounterPage.svelte',
    lines: [
      [null, '<script lang="ts">'],
      [null, '  let { page }: { page: CounterPageReference } = $props();'],
      [null, '  const counter = useView(() => page);'],
      ['increment', '  const increment = useCommand('],
      ['increment', '    () => counter.client?.«increment|increment»());'],
      ['step', '  const setStep = useCommand('],
      ['step', '    (step: number) => counter.client?.«step|setStep»(step));'],
      [null, '</script>'],
      [null, ''],
      ['count', '<p class="count">{counter.state?.«count|count» ?? "…"}</p>'],
      ['step', '<select bind:value={'],
      ['step', '  () => counter.state?.«step|step» ?? 1,'],
      ['step', '  step => setStep.run(step)'],
      ['step', '}>'],
      [null, '  {#each [1, 2, 5, 10] as step (step)}'],
      [null, '    <option value={step}>{step}</option>'],
      [null, '  {/each}'],
      [null, '</select>'],
      [
        'increment',
        '<button onclick={() => increment.run()}>Increment</button>',
      ],
    ],
  },
  {
    id: 'angular',
    label: 'Angular',
    file: 'counter.ts',
    lines: [
      [null, 'export class CounterComponent {'],
      [null, '  readonly page = input.required<CounterPageReference>();'],
      [null, '  readonly counter = injectView(this.page);'],
      [null, '  readonly state = this.counter.state;'],
      ['increment', '  readonly increment = injectCommand('],
      [
        'increment',
        '    () => this.counter.client()?.«increment|increment»());',
      ],
      ['step', '  readonly setStep = injectCommand('],
      [
        'step',
        '    (step: number) => this.counter.client()?.«step|setStep»(step));',
      ],
      [null, '}'],
      [null, ''],
      [null, '<!-- counter.html -->'],
      ['count', '<p class="count">{{ state()?.«count|count» ?? "…" }}</p>'],
      ['step', '<select #step (change)="setStep.run(+step.value)">'],
      [null, '  @for (value of steps; track value) {'],
      ['step', '    <option [value]="value"'],
      ['step', '      [selected]="value === (state()?.«step|step» ?? 1)">'],
      [null, '      {{ value }}'],
      [null, '    </option>'],
      [null, '  }'],
      [null, '</select>'],
      ['increment', '<button (click)="increment.run()">Increment</button>'],
    ],
  },
];

const token = /«(count|step|increment)\|([^»]+)»/g;

export function tokens(text: string): Token[] {
  const result: Token[] = [];
  let last = 0;
  for (const match of text.matchAll(token)) {
    if (match.index > last)
      result.push({ text: text.slice(last, match.index) });
    result.push({ text: match[2], member: match[1] as Member });
    last = match.index + match[0].length;
  }
  if (last < text.length) result.push({ text: text.slice(last) });
  return result;
}
