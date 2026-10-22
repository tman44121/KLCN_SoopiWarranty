"""Check that a failing child script exposes its actual error in the notebook."""
import ast
import contextlib
import io
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class NotebookTests(unittest.TestCase):
    def test_training_output_and_failure_are_preserved(self):
        notebook = json.loads(Path(__file__).with_name('warranty-lora.ipynb').read_text(encoding='utf-8'))
        cell = next(cell for cell in notebook['cells'] if cell['id'] == 'soopi-5')
        tree = ast.parse(''.join(cell['source']))
        # Execute the actual launch code, without requiring model/GPU/result files.
        boundary = next(i for i, node in enumerate(tree.body) if isinstance(node, ast.Assign)
                        and any(isinstance(t, ast.Name) and t.id == 'output' for t in node.targets))
        tree.body = tree.body[:boundary]
        code = compile(tree, '<notebook training launcher>', 'exec')
        with tempfile.TemporaryDirectory() as directory:
            project = Path(directory)
            script = project / 'train.py'
            stdout = io.StringIO()
            scope = dict(project=project, experiment=project, subprocess=subprocess, sys=sys)
            script.write_text("import sys\nprint('ROOT_ERROR: example failure', file=sys.stderr)\nsys.exit(7)\n", encoding='utf-8')
            with contextlib.redirect_stdout(stdout), self.assertRaisesRegex(RuntimeError, '7'):
                exec(code, scope)
            self.assertIn('ROOT_ERROR: example failure', stdout.getvalue())
            self.assertIn('ROOT_ERROR: example failure', (project / 'training.log').read_text(encoding='utf-8'))
            script.write_text("print('SUCCESS')\n", encoding='utf-8')
            with contextlib.redirect_stdout(stdout):
                exec(code, scope)
            self.assertEqual(scope['returncode'], 0)
            saved = (project / 'training.log').read_text(encoding='utf-8')
            self.assertIn('ROOT_ERROR', saved)
            self.assertIn('SUCCESS', saved)


if __name__ == '__main__':
    unittest.main()
