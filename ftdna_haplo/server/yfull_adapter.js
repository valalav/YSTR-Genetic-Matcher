const { YFullTree } = require('./yfull_tree');

class YFullAdapter {
    constructor(jsonData) {
        this.yfullTree = new YFullTree(jsonData);
        this.cache = new Map();
    }

    convertNodeToFTDNAFormat(yfullNode) {
        if (!yfullNode) return null;
        if (this.cache.has(yfullNode.id)) {
            return this.cache.get(yfullNode.id);
        }

        const ftdnaNode = {
            id: yfullNode.id,
            haplogroupId: yfullNode.id,
            parentId: yfullNode.parentId || null,
            name: this.formatHaplogroupName(yfullNode),
            isRoot: !yfullNode.parentId,
            root: yfullNode.id.split('-')[0],
            kitsCount: 0,
            subBranches: yfullNode.children?.length || 0,
            variants: this.convertSnps(yfullNode.formattedSnps),
            children: [],
            tmrca: yfullNode.tmrca,
            formed: yfullNode.formed
        };

        // Преобразуем дочерние узлы
        if (yfullNode.children) {
            ftdnaNode.children = yfullNode.children.map(child => ({
                id: child.id,
                haplogroupId: child.id,
                name: this.formatHaplogroupName(child),
                tmrca: child.tmrca,
                formed: child.formed
            }));
        }

        this.cache.set(yfullNode.id, ftdnaNode);
        return ftdnaNode;
    }

    getSubtree(haplogroupId) {
        const node = this.yfullTree.findNodeById(haplogroupId);
        if (!node) return null;
        return this._buildSubtree(node);
    }

    _buildSubtree(node) {
        if (!node) return null;

        const result = {
            id: node.id,
            haplogroupId: node.id,
            name: this.formatHaplogroupName(node),
            kitsCount: 0,
            tmrca: node.tmrca,
            formed: node.formed,
            children: []
        };

        if (node.children && node.children.length > 0) {
            result.children = node.children
                .map(child => this._buildSubtree(child))
                .filter(Boolean)
                .sort((a, b) => (b.tmrca || 0) - (a.tmrca || 0));
        }

        return result;
    }

    formatHaplogroupName(node) {
        if (!node) return '';
        // Просто возвращаем ID ноды, без добавления SNP
        return node.id;
        
        /* Убираем старую логику
        const baseId = node.id;
        const mainSnp = node.formattedSnps?.[0]?.primary;
        
        if (!mainSnp || baseId.includes(mainSnp)) {
            return baseId;
        }
        
        return `${baseId}-${mainSnp}`;
        */
    }

    convertSnps(snps) {
        if (!snps) return [];
        
        return snps.map(snp => ({
            variant: snp.primary,
            position: snp.position || 0,
            ancestral: snp.ancestral || '',
            derived: snp.derived || '',
            alternativeNames: snp.alternatives || []
        }));
    }

    findHaplogroup(term) {
        const results = this.yfullTree.searchNodes(term);
        if (results.length === 0) return null;
        return this.convertNodeToFTDNAFormat(results[0].node);
    }

    getHaplogroupDetails(haplogroupId) {
        const yfullDetails = this.yfullTree.getNodeDetails(haplogroupId);
        if (!yfullDetails) return null;

        const result = {
            id: yfullDetails.id,
            haplogroupId: yfullDetails.id,
            name: this.formatHaplogroupName(yfullDetails),
            variants: yfullDetails.snps?.map(snp => ({
                variant: snp.primary,
                alternativeNames: snp.alternatives || []
            })) || [],
            path: {
                nodes: yfullDetails.path.nodes.map(node => ({
                    id: node.id,
                    name: this.formatHaplogroupName(node),
                    displayName: this.formatHaplogroupName(node)
                })),
                string: yfullDetails.path.nodes.map(node => this.formatHaplogroupName(node)).join(' > ')
            },
            statistics: {
                kitsCount: 0,
                subBranches: yfullDetails.children?.length || 0,
                tmrca: yfullDetails.tmrca || null,
                formed: yfullDetails.formed || null
            },
            children: yfullDetails.children?.map(child => ({
                id: child.id,
                name: this.formatHaplogroupName(child),
                tmrca: child.tmrca || null,
                formed: child.formed || null
            })) || []
        };

        return result;
    }

    searchWithAutocomplete(term, limit = 10) {
        return this.yfullTree.searchNodes(term, limit).map(result => ({
            type: 'SNP',
            value: result.match,
            haplogroup: this.formatHaplogroupName(result.node),
            source: 'yfull'
        }));
    }

    findParentWithSNP(nodeId, snp) {
        let current = this.yfullTree.findNodeById(nodeId);
        while (current) {
            if (current.formattedSnps?.some(s => 
                s.primary === snp || s.alternatives?.includes(snp)
            )) {
                return this.convertNodeToFTDNAFormat(current);
            }
            current = current.parentId ? 
                this.yfullTree.findNodeById(current.parentId) : null;
        }
        return null;
    }

    isSubclade(haplogroupName, parentHaplogroupName) {
        return this.yfullTree.isSubclade(haplogroupName, parentHaplogroupName);
    }

    getAllSubclades(parentHaplogroupName) {
        const parentNode = this.yfullTree.findNodeById(parentHaplogroupName);
        if (!parentNode) {
            return [];
        }

        const subclades = new Set();
        const queue = [parentNode];
        
        subclades.add(this.formatHaplogroupName(parentNode));

        while (queue.length > 0) {
            const currentNode = queue.shift();

            if (currentNode && currentNode.children && Array.isArray(currentNode.children)) {
                for (const childNode of currentNode.children) {
                    if (childNode) {
                        subclades.add(this.formatHaplogroupName(childNode));
                        queue.push(childNode);
                    }
                }
            }
        }
        
        return Array.from(subclades);
    }
}

module.exports = { YFullAdapter };