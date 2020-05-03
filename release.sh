#!/bin/bash -e

fail() {
  echo "ERROR:" $* > /dev/stderr
  exit 1
}

npm run test
git add .
git diff --staged --quiet || fail "Unexpected diffs"

old_version=$(node -e "console.log(require('./package').version)")
read -p "New version number? (currently ${old_version}) >> " version

if [[ -z "$version" ]]; then
  fail "Must specify a version"
fi

node -e "let json = require('./package');
json.version = '${version}';
fs.writeFileSync('package.json', JSON.stringify(json, null, 2) + '\n');"

git add .
git cmt -m "v${version}"
git tag -s -m "$version" "$version"
git push --follow-tags
npm publish
