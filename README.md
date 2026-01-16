# Quest Schedule Exporter

This is a web app that takes in your course schedule from University of Waterloo's Quest and exports it as ICS.

## Development

*Note: This project uses Cloudflare Pages for deployment.*

```sh
bun install
bun dev
```

### Other Commands

- Build production site: `bun run build`
- Preview production site: `bun preview`
- Deploy to Cloudflare: `bun run deploy`

## Credits

I used to use this [tool](https://web.archive.org/web/20250609135711/https://schedule.wattools.ca/) for multiple years until it stopped working. So I decided to give it a fresh face and handle much stricter input validation. If there are any issues or suggestions, please feel free to open an issue or submit a PR.

## License

This project is licensed under MPL-2.0. See [LICENSE](LICENSE) for details.
