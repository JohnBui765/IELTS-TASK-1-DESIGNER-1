// Topics for generated charts. The figures are invented; only their shape is
// realistic. Three shapes:
//   'time'   — one value per group per year (or hour / month): line, bar, table
//   'parts'  — percentages of a whole: pie, bar, table
//   'groups' — categories × series at one point in time: bar, table
// Fields: title (chart title), measure (rubric noun phrase), measureAlt
// (a paraphrase for the introduction), unit, range [lo, hi], groups (series
// or slice names), groupNoun, per (the preposition joining measure and group),
// theme (pairs topics for two-visual tasks).

const COUNTRIES = ['Australia', 'Indonesia', 'Canada', 'South Africa', 'Colombia', 'Russia'];

export const TOPICS = [
  // ---------- time ----------
  { id: 'coal-exports', shape: 'time', short: 'coal exports', plural: true, theme: 'energy', title: 'Coal exports', measure: 'coal exports', measureAlt: 'the amount of coal exported', perAlt: 'by',
    unit: { kind: 'number', label: 'million tonnes' }, range: [20, 400], groups: COUNTRIES, groupNoun: 'countries', per: 'from', countable: false },
  { id: 'car-ownership', shape: 'time', short: 'car ownership', plural: false, trend: 'up', theme: 'transport', title: 'Car ownership', measure: 'the number of cars per 1,000 people', measureAlt: 'levels of car ownership',
    unit: { kind: 'number', label: 'cars per 1,000 people' }, range: [40, 650], groups: ['Japan', 'Brazil', 'Poland', 'Vietnam', 'Mexico', 'Turkey'], groupNoun: 'countries', per: 'in', years: 'long', countable: true },
  { id: 'internet-users', shape: 'time', short: 'internet use', plural: false, trend: 'up', theme: 'technology', title: 'Internet users', measure: 'the percentage of the population using the internet', measureAlt: 'the proportion of people who used the internet',
    unit: { kind: 'percent' }, range: [3, 96], groups: ['Vietnam', 'Kenya', 'Peru', 'Egypt', 'the Philippines', 'Ukraine'], groupNoun: 'countries', per: 'in' },
  { id: 'tourist-arrivals', shape: 'time', short: 'tourist arrivals', plural: true, theme: 'tourism', title: 'International tourist arrivals', measure: 'the number of international tourist arrivals', measureAlt: 'how many overseas visitors arrived',
    unit: { kind: 'number', label: 'million visitors' }, range: [2, 90], groups: ['Spain', 'Thailand', 'Vietnam', 'Japan', 'Mexico', 'Greece'], groupNoun: 'countries', per: 'in', countable: true },
  { id: 'rice-production', shape: 'time', short: 'rice production', plural: false, theme: 'food', title: 'Rice production', measure: 'rice production', measureAlt: 'the quantity of rice produced',
    unit: { kind: 'number', label: 'million tonnes' }, range: [10, 220], groups: ['India', 'Indonesia', 'Vietnam', 'Thailand', 'Bangladesh', 'the Philippines'], groupNoun: 'countries', per: 'in', countable: false },
  { id: 'museum-visits', shape: 'time', short: 'attendance', subjectPer: 'at', theme: 'leisure', title: 'Museum visits', measure: 'the number of visits', measureAlt: 'visitor numbers', perAlt: 'at',
    unit: { kind: 'number', label: 'thousand visits' }, range: [50, 900], groups: ['the Science Museum', 'the Art Gallery', 'the History Museum', 'the Maritime Museum'], groupNoun: 'museums in a city', groupShort: 'museums', per: 'to', countable: true },
  { id: 'unemployment', shape: 'time', short: 'unemployment', plural: false, theme: 'work', title: 'Unemployment rate', measure: 'unemployment rates', measureAlt: 'the proportion of the workforce without a job',
    unit: { kind: 'percent' }, range: [2, 24], groups: ['Spain', 'Poland', 'Ireland', 'Greece', 'Sweden', 'Portugal'], groupNoun: 'countries', per: 'in', decimals: 1 },
  { id: 'house-prices', shape: 'time', short: 'average house prices', plural: true, theme: 'housing', title: 'Average house prices', measure: 'average house prices', measureAlt: 'the average cost of a home',
    unit: { kind: 'currency', symbol: '£' }, range: [80000, 520000], round: 1000, groups: ['London', 'Manchester', 'Edinburgh', 'Cardiff', 'Belfast'], groupNoun: 'cities', per: 'in' },
  { id: 'water-use', shape: 'time', short: 'water consumption', plural: false, theme: 'environment', title: 'Domestic water use', measure: 'domestic water consumption per person', measureAlt: 'how much water each person used at home',
    unit: { kind: 'number', label: 'litres per day' }, range: [80, 380], groups: ['the USA', 'Italy', 'Germany', 'India', 'Australia'], groupNoun: 'countries', per: 'in', countable: false },
  { id: 'renewables', shape: 'time', short: 'the share of renewable electricity', plural: false, trend: 'up', theme: 'energy', title: 'Electricity from renewable sources', measure: 'the proportion of electricity generated from renewable sources', measureAlt: 'the share of electricity that came from renewables',
    unit: { kind: 'percent' }, range: [2, 82], groups: ['Germany', 'Spain', 'Denmark', 'Japan', 'the UK', 'Brazil'], groupNoun: 'countries', per: 'in' },
  { id: 'student-enrolments', shape: 'time', short: 'international student numbers', plural: true, trend: 'up', theme: 'education', title: 'International students', measure: 'the number of international students enrolled at universities', measureAlt: 'international student enrolments', perAlt: 'in',
    unit: { kind: 'number', label: 'thousand students' }, range: [20, 1100], groups: ['the USA', 'the UK', 'Australia', 'Canada', 'Germany'], groupNoun: 'countries', per: 'in', countable: true },
  { id: 'smartphones', shape: 'time', short: 'smartphone ownership', plural: false, trend: 'up', theme: 'technology', title: 'Smartphone ownership by age group', measure: 'the percentage of people who owned a smartphone', measureAlt: 'smartphone ownership', perAlt: 'among',
    unit: { kind: 'percent' }, range: [5, 98], groups: ['16–24', '25–34', '35–54', '55–64', '65+'], groupNoun: 'age groups', per: 'in', subjectPer: 'among', years: 'short', listNames: false, groupPrefix: 'people aged ' },
  { id: 'cinema', shape: 'time', short: 'cinema attendance', theme: 'leisure', title: 'Cinema admissions', measure: 'cinema admissions', measureAlt: 'the number of cinema tickets sold',
    unit: { kind: 'number', label: 'million admissions' }, range: [40, 220], groups: ['France', 'Germany', 'Italy', 'the UK', 'Spain'], groupNoun: 'countries', per: 'in', countable: true },
  { id: 'co2', shape: 'time', short: 'carbon emissions', plural: true, theme: 'environment', title: 'Carbon dioxide emissions per person', measure: 'carbon dioxide emissions per person', measureAlt: 'the average amount of CO₂ each person produced',
    unit: { kind: 'number', label: 'tonnes per person' }, range: [1, 20], decimals: 1, groups: ['the USA', 'the UK', 'China', 'India', 'Sweden'], groupNoun: 'countries', per: 'in', years: 'long', countable: false },
  { id: 'book-sales', shape: 'time', short: 'sales', plural: true, theme: 'leisure', title: 'Book sales by format', measure: 'sales of books', measureAlt: 'the number of books sold',
    unit: { kind: 'number', label: 'million copies' }, range: [2, 300], groups: ['printed books', 'e-books', 'audiobooks'], groupNoun: 'formats', per: 'in', subjectPer: 'of', years: 'short', listNames: false, countable: true },
  { id: 'transport-journeys', shape: 'time', short: 'travel', theme: 'transport', title: 'Public transport journeys', measure: 'the number of journeys made in a city', measureAlt: 'how many trips people in a city made',
    unit: { kind: 'number', label: 'million journeys' }, range: [5, 600], groups: ['bus', 'underground', 'tram', 'suburban rail'], groupNoun: 'modes of public transport', groupShort: 'modes of transport', per: 'by', countable: true },
  { id: 'life-expectancy', shape: 'time', short: 'life expectancy', plural: false, trend: 'up', theme: 'health', title: 'Life expectancy at birth', measure: 'life expectancy at birth', measureAlt: 'how long people could expect to live',
    unit: { kind: 'number', label: 'years' }, range: [45, 86], decimals: 1, groups: ['Japan', 'Nigeria', 'India', 'Brazil', 'Russia'], groupNoun: 'countries', per: 'in', years: 'long' },
  { id: 'takeaway-spending', shape: 'time', short: 'spending', plural: false, theme: 'food', title: 'Weekly spending on takeaway food', measure: 'average weekly household spending', measureAlt: 'how much the average household spent each week',
    unit: { kind: 'currency', symbol: '£', decimals: 2 }, range: [0.5, 9], groups: ['pizza', 'burgers', 'noodles', 'sandwiches'], groupNoun: 'types of takeaway food', groupShort: 'types of food', per: 'on', years: 'short' },
  { id: 'recycling', shape: 'time', short: 'the recycling rate', plural: false, trend: 'up', theme: 'environment', title: 'Household waste recycled', measure: 'the percentage of household waste that was recycled', measureAlt: 'recycling rates for household waste',
    unit: { kind: 'percent' }, range: [5, 68], groups: ['Wales', 'Ireland', 'France', 'Italy', 'Poland'], groupNoun: 'countries', per: 'in' },
  { id: 'electricity-day', shape: 'time', short: 'demand', plural: false, theme: 'energy', title: 'Electricity demand over a typical day', measure: 'electricity demand over a typical day', measureAlt: 'how much electricity is needed at different times of day',
    unit: { kind: 'number', label: 'thousand megawatts' }, range: [12, 48], groups: ['winter', 'summer'], groupNoun: 'seasons', per: 'in', axis: 'hours', allGroups: true, countable: false },
  { id: 'rainfall', shape: 'time', short: 'rainfall', plural: false, theme: 'environment', title: 'Average monthly rainfall', measure: 'average monthly rainfall', measureAlt: 'how much rain typically falls each month',
    unit: { kind: 'number', label: 'millimetres' }, range: [0, 520], groups: ['Mumbai', 'Lisbon', 'Singapore'], groupNoun: 'cities', per: 'in', axis: 'months', allGroups: true, countable: false },

  // ---------- parts (percentages of a whole) ----------
  { id: 'household-spending', shape: 'parts', prose: { other: 'other items' }, base: [31, 17, 15, 11, 7, 19], theme: 'housing', title: 'Household spending', measure: 'how the average household budget was spent', measureAlt: 'the breakdown of household spending',
    whole: 'household spending', place: 'in Canada', groups: ['housing', 'food', 'transport', 'leisure', 'clothing', 'other'] },
  { id: 'energy-mix', shape: 'parts', prose: { nuclear: 'nuclear power', hydro: 'hydroelectric power', 'wind and solar': 'wind and solar power', other: 'other sources' }, base: [30, 25, 18, 12, 10, 5], theme: 'energy', title: 'Electricity generation by source', measure: 'the sources of electricity generation', measureAlt: 'where electricity came from',
    whole: 'electricity generation', place: 'in one country', groups: ['coal', 'natural gas', 'nuclear', 'hydro', 'wind and solar', 'other'] },
  { id: 'waste-types', shape: 'parts', prose: { food: 'food waste', other: 'other materials' }, base: [32, 22, 18, 9, 6, 13], theme: 'environment', title: 'Household waste by type', measure: 'the composition of household waste', measureAlt: 'what household rubbish consisted of',
    whole: 'household waste', place: 'in a European city', groups: ['food', 'paper', 'plastic', 'glass', 'metal', 'other'] },
  { id: 'student-day', shape: 'parts', prose: { 'social media': 'using social media', other: 'other activities' }, base: [33, 21, 14, 12, 5, 15], theme: 'education', title: 'How students spend a weekday', measure: 'how university students spend a typical weekday', measureAlt: 'the way students divide their time on a weekday',
    whole: 'students’ time on a typical weekday', place: '', groups: ['sleeping', 'studying', 'social media', 'paid work', 'exercise', 'other'], undated: true },
  { id: 'travel-reasons', shape: 'parts', prose: { business: 'business trips', other: 'other reasons' }, base: [58, 24, 11, 4, 3], theme: 'tourism', title: 'Reasons for international travel', measure: 'the main reasons UK residents gave for travelling abroad', measureAlt: 'why UK residents travelled overseas',
    whole: 'international trips', place: '', groups: ['holidays', 'visiting family and friends', 'business', 'study', 'other'] },
  { id: 'water-sectors', shape: 'parts', prose: {}, base: [60, 20, 20], theme: 'environment', title: 'Water use by sector', measure: 'how water was used', measureAlt: 'the share of water consumed by each sector',
    whole: 'water use', place: '', groups: ['agriculture', 'industry', 'domestic use'], pieLabels: ['Africa', 'Europe', 'North America'] },
  { id: 'university-income', shape: 'parts', prose: { other: 'other sources' }, base: [45, 25, 18, 5, 7], theme: 'education', title: 'University income by source', measure: 'the sources of income at one university', measureAlt: 'where a university’s funding came from',
    whole: 'the university’s income', place: '', groups: ['tuition fees', 'government grants', 'research contracts', 'donations', 'other'] },
  { id: 'commuting', shape: 'parts', prose: { car: 'driving', bus: 'taking the bus', train: 'taking the train', bicycle: 'cycling', other: 'other means of transport' }, base: [41, 18, 15, 7, 12, 7], theme: 'transport', title: 'How employees travel to work', measure: 'how employees in a city travelled to work', measureAlt: 'the means of transport commuters used',
    whole: 'commuting journeys', place: '', groups: ['car', 'bus', 'train', 'bicycle', 'walking', 'other'] },

  // ---------- groups (categories × series) ----------
  { id: 'exercise', shape: 'groups', theme: 'health', title: 'Adults who exercise regularly', measure: 'the percentage of men and women in different age groups who exercised regularly', measureAlt: 'how many men and women of different ages took regular exercise',
    unit: { kind: 'percent' }, range: [12, 78], categories: ['18–24', '25–34', '35–44', '45–54', '55–64', '65+'], categoryNoun: 'age groups', groups: ['men', 'women'], groupNoun: 'genders' },
  { id: 'reading', shape: 'groups', theme: 'leisure', title: 'Time spent reading each week', measure: 'the average number of hours that people of different ages spend reading print and digital material each week', measureAlt: 'how long people of different ages spend reading',
    unit: { kind: 'number', label: 'hours per week' }, range: [0.5, 9], decimals: 1, categories: ['under 18', '18–34', '35–54', '55+'], categoryNoun: 'age groups', groups: ['print', 'digital'], prose: { print: 'print reading', digital: 'digital reading' }, groupNoun: 'formats', undated: true },
  { id: 'visitor-spending', shape: 'groups', theme: 'tourism', title: 'Average spending per visit', measure: 'the average amount spent per visit by tourists from five countries', measureAlt: 'how much visitors from each country spent on a trip',
    unit: { kind: 'currency', symbol: '£' }, range: [300, 2400], round: 10, categories: ['Germany', 'the USA', 'Japan', 'China', 'Australia'], categoryNoun: 'countries', groups: ['2015', '2023'], groupNoun: 'years', seriesAreYears: true },
  { id: 'workforce', shape: 'groups', theme: 'work', title: 'Workforce by sector', measure: 'the proportion of workers employed in agriculture, industry and services in five countries', measureAlt: 'how each country’s workforce was divided between sectors',
    unit: { kind: 'percent' }, range: [2, 82], categories: ['India', 'Brazil', 'Japan', 'Nigeria', 'Germany'], categoryNoun: 'countries', groups: ['agriculture', 'industry', 'services'], groupNoun: 'sectors', sumsTo100: true },
  { id: 'broadband', shape: 'groups', theme: 'technology', title: 'Average broadband speed', measure: 'average broadband download speeds in six countries', measureAlt: 'how fast home internet connections were',
    unit: { kind: 'number', label: 'Mbps' }, range: [8, 240], categories: ['South Korea', 'France', 'Chile', 'Italy', 'Thailand', 'Egypt'], categoryNoun: 'countries', groups: ['2018', '2024'], groupNoun: 'years', seriesAreYears: true },
  { id: 'graduates', shape: 'groups', theme: 'education', title: 'University graduates by subject', measure: 'the number of men and women who graduated in six subjects', measureAlt: 'how many men and women graduated in each subject',
    unit: { kind: 'number', label: 'thousand graduates' }, range: [4, 60], categories: ['engineering', 'medicine', 'business', 'law', 'arts', 'education'], categoryNoun: 'subjects', groups: ['men', 'women'], groupNoun: 'genders', countable: true },
  { id: 'sleep', shape: 'groups', theme: 'health', title: 'Average hours of sleep', measure: 'the average number of hours that people in five age groups sleep on weekdays and at weekends', measureAlt: 'how long people of different ages sleep',
    unit: { kind: 'number', label: 'hours' }, range: [5.5, 9.5], decimals: 1, categories: ['13–17', '18–25', '26–40', '41–60', '61+'], categoryNoun: 'age groups', groups: ['weekdays', 'weekends'], groupNoun: 'days', undated: true },
];

export const topicById = (id) => TOPICS.find((t) => t.id === id) || null;
