import type { BlogConfig } from './template/blog.config.ts';

const config: BlogConfig = {
  name: "DevAIToolkit.com",
  homeTitle: "AI Tools for Developers — Reviews, APIs & Guides | DevAIToolkit.com",
  description: "AI tools, APIs, and development resources for software engineers",
  site: "https://devaitoolkit.com",
  language: "en",
  niche: "AI tools for developers, reviews",
  colors: { primary: "#8b5cf6", accent: "#f43f5e" },
  analytics: { plausibleDomain: "devaitoolkit.com" },
  author: {
    name: 'Sergii Muliarchuk',
    url: 'https://flipfactory.it.com',
    sameAs: [
      'https://www.linkedin.com/in/sergii-muliarchuk/',
      'https://github.com/MuliarchukSV',
    ],
  },
};

export default config;
