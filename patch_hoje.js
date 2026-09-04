const fs = require('fs');
let code = fs.readFileSync('src/pages/Hoje.tsx', 'utf8');

if (!code.includes('seedDemo')) {
    code = code.replace(
        "import { useData } from '../context/DataContext';",
        "import { useData } from '../context/DataContext';\nimport { updatePublicForm } from '../services/db';\nimport { useSearchParams } from 'react-router-dom';"
    );
    code = code.replace(
        "const { user, office } = useAuth();",
        "const { user, office } = useAuth();\n  const [searchParams] = useSearchParams();\n  \n  React.useEffect(() => {\n    if (searchParams.get('seed') === 'true' && office?.id) {\n      updatePublicForm('clara-almeida-demo', {\n        officeId: office.id,\n        officeName: 'Clara Almeida Advocacia',\n        lawyerName: 'Dra. Clara Almeida — modelo fictício',\n        whatsapp: '',\n        email: '',\n        city: 'Poços de Caldas',\n        state: 'MG',\n        areas: ['Direito de Família', 'Direito Sucessório'],\n        isActive: true,\n      }).then(() => alert('Demo seeded!'));\n    }\n  }, [searchParams, office?.id]);"
    );
    fs.writeFileSync('src/pages/Hoje.tsx', code);
    console.log('Patched Hoje.tsx');
}
