# Public deployment

Primary application: https://cgair.github.io/arc-receipt/

GitHub Pages serves the `gh-pages` branch, whose root is the exact `dist/` subtree from source. Relative asset URLs support the repository path. The application runs all chain reads in the browser against Arc mainnet; there is no backend or required secret.

Update after testing:

```sh
git subtree split --prefix=dist -b pages-next
git push github pages-next:gh-pages
git branch -D pages-next
```

Sites deployment also succeeded for project `appgprj_6ac16223f2308191a86b5e68d2c2adf8`, version 1, source commit `d8ededce63a6c25a9a4f57eaa7bf1a32d5081baa`. However, the returned `chatgpt.site` domain produced a Cloudflare blocked page during independent browser acceptance. It is not the submission link. GitHub Pages provides the public reviewable deployment.

No contracts were deployed, no wallet was connected, and no funds were moved. The project is a read-only application using existing Arc mainnet infrastructure.
