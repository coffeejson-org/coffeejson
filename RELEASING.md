# Releasing a package

`@coffeejson/core` and `@coffeejson/react` version together, on semver, apart
from the format ([Versioning](docs/spec/07-versioning.md#what-you-can-rely-on-today)).
The format's own release is the root `CHANGELOG.md` and a `major.minor` tag
such as `1.1`; this page is the packages only.

## Before the publish, in one commit

1. Set `version` in `packages/core/package.json` and
   `packages/react/package.json`. React's dependency on core stays
   `workspace:^`; `pnpm publish` rewrites it to `^<core's version>`.
2. In `packages/core/CHANGELOG.md`, retitle `## [Unreleased]` to
   `## [<version>] — <date>`. Add the same section to
   `packages/react/CHANGELOG.md`, saying which core it now needs and what, if
   anything, changed in the components.
3. Run `pnpm install --frozen-lockfile`, `pnpm -r build` and `pnpm test:all`,
   which must pass, and `pnpm check:ci`, which must report nothing.
4. Pack both and read the result, because the tarball is what ships:

       pnpm --filter @coffeejson/core pack --pack-destination /tmp/cj
       pnpm --filter @coffeejson/react pack --pack-destination /tmp/cj

   Each `package.json` inside carries the new version, react's carries
   `"@coffeejson/core": "^<version>"`, and `dist/`, the schemas and
   `CHANGELOG.md` are present.

## Publish, core first

React's dependency must already resolve on the registry, so core goes first.
`prepack` builds, and pnpm refuses a dirty tree or a branch other than `main`.

    pnpm --filter @coffeejson/core publish
    pnpm --filter @coffeejson/react publish

`pnpm publish`, never `npm publish`: only pnpm rewrites `workspace:^`.

## After the publish

Tag the commit each package was published from, as an annotated tag, after
the publish and not before, because the tarball on the registry carries no
provenance attestation and no commit reference. The tag is the only record.

    git tag -a core-v<version> -m "@coffeejson/core <version>"
    git tag -a react-v<version> -m "@coffeejson/react <version>"
    git push origin main core-v<version> react-v<version>

Then start the next `## [Unreleased]` in `packages/core/CHANGELOG.md` with
the first change that lands.
