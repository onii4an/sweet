class CreateBoys < ActiveRecord::Migration[5.1]
  def change
    create_table :boys do |t|

      t.timestamps
    end
  end
end
