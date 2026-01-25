import React from 'react';
import { Product } from '../types';

interface ProductListProps {
  products: Product[];
  selectedProduct: Product | null;
  onSelect: (product: Product) => void;
  groupByCategory?: boolean;
}

const ProductList: React.FC<ProductListProps> = ({
  products,
  selectedProduct,
  onSelect,
  groupByCategory
}) => {
  const renderProductCard = (product: Product) => (
    <div
      key={product.id}
      className={`product-card ${selectedProduct?.id === product.id ? 'selected' : ''}`}
      onClick={() => onSelect(product)}
    >
      {product.image_url && (
        <img src={product.image_url} alt={product.name} className="product-image" />
      )}
      <div className="product-info">
        <h3>{product.name}</h3>
        {product.description && <p className="product-description">{product.description}</p>}
        <div className="product-details">
          <span className="product-price">{product.price}</span>
          <span className="product-chain">{product.chain}</span>
        </div>
      </div>
    </div>
  );

  if (groupByCategory) {
    const grouped: Record<string, Product[]> = {};
    products.forEach((product) => {
      const key = product.category || '其他';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(product);
    });

    const orderedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'NFT') return -1;
      if (b === 'NFT') return 1;
      if (a === 'Token') return -1;
      if (b === 'Token') return 1;
      return a.localeCompare(b);
    });

    return (
      <div className="product-list">
        <h2>搜索结果</h2>
        {orderedKeys.map((category) => (
          <div key={category} className="product-group">
            <div className="product-group-title">{category}</div>
            <div className="products-grid">
              {grouped[category].map(renderProductCard)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="product-list">
      <h2>搜索结果</h2>
      <div className="products-grid">
        {products.map(renderProductCard)}
      </div>
    </div>
  );
};

export default ProductList;
